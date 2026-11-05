import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@incubaunas/db';
import { InMemoryEventBus, OutboxRelay } from '@incubaunas/events';
import {
  ADMIN_ORIGIN,
  IDP,
  createHarness,
  dbConfigured,
  unique,
  type Credentials,
  type Harness,
} from '../support/harness.js';

type Session = NonNullable<Credentials['session']>;
const iso = (offsetMs: number, from = Date.now()) => new Date(from + offsetMs).toISOString();
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!dbConfigured)('Platform API — flujos completos sobre PostgreSQL real', () => {
  let h: Harness;
  let admin: Credentials;

  beforeAll(async () => {
    h = await createHarness();
    admin = { bearer: await h.bearer({ scopes: ['platform:admin'] }) };
  });
  afterAll(() => h.close());

  // ------------------------------------------------------------ utilidades
  async function createOrganization(options: { slug?: string; key?: string } = {}) {
    const u = unique();
    const owner = { subject: `owner-${u}`, email: `owner-${u}@example.test` };
    const body = {
      slug: options.slug ?? `org-${u}`,
      display_name: `Organización ${u}`,
      timezone: 'America/Lima',
      locale: 'es-PE',
      owner_identity: {
        issuer: IDP,
        subject: owner.subject,
        email: owner.email,
        display_name: 'Owner',
      },
    };
    const response = await h.call('createOrganization', {
      as: admin,
      body,
      headers: options.key ? { 'idempotency-key': options.key } : {},
    });
    return { response, body, org: response.body, owner };
  }

  const loginAs = (
    identity: { subject: string; email: string },
    amr = ['pwd', 'mfa'],
    emailVerified = true,
  ) =>
    h.login({
      subject: identity.subject,
      email: identity.email,
      emailVerified,
      name: 'Persona',
      amr,
      authTime: h.clock.now(),
    });

  async function ownerSession(amr?: string[]) {
    const { org, owner } = await createOrganization();
    const { session } = await loginAs(owner, amr);
    return { org, owner, session };
  }

  async function addMember(orgId: string, as: Session, roles: string[]) {
    const u = unique();
    const identity = { subject: `m-${u}`, email: `m-${u}@example.test` };
    const invitation = await h.call('createInvitation', {
      params: { organization_id: orgId },
      as: { session: as },
      body: { email: identity.email, roles, expires_at: iso(DAY, h.clock.now().getTime()) },
    });
    expect(invitation.status, JSON.stringify(invitation.body)).toBe(201);
    const message = h.notifier.sent.at(-1)!;
    const token = decodeURIComponent(message.acceptUrl.split('/invitations/')[1]!);

    const { session } = await loginAs(identity);
    const accepted = await h.call('acceptInvitation', { params: { token }, as: { session } });
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    // Con la membresía ya creada, la persona cambia de contexto a la organización.
    const switched = await h.call('switchOrganizationContext', {
      as: { session },
      body: { organization_id: orgId },
    });
    expect(switched.status).toBe(204);
    return {
      identity,
      token,
      membership: accepted.body,
      session: {
        cookie: switched.cookies['__Host-session']!,
        csrf: switched.cookies['__Host-csrf']!,
      },
    };
  }

  // ------------------------------------------------------------ PF-001, PF-020: organizaciones
  describe('organizaciones', () => {
    it('crea una organización activa con su owner, y publica los eventos de contrato', async () => {
      const { response, org } = await createOrganization();
      expect(response.status).toBe(201);
      expect(org).toMatchObject({ state: 'active', revision: 2, timezone: 'America/Lima' });
      expect(response.headers.etag).toBe('"2"');

      const { rows } = await h.pool.query(
        `select topic from outbox where organization_id = $1 order by id`,
        [org.id],
      );
      expect(rows.map((r) => r.topic)).toEqual([
        'platform.organization.lifecycle_changed.v1',
        'platform.membership.changed.v1',
      ]);
    });

    it('es idempotente: la misma clave y cuerpo reproduce la respuesta; otro cuerpo da 409', async () => {
      const key = randomUUID();
      const first = await createOrganization({ key });
      const replay = await h.call('createOrganization', {
        as: admin,
        body: first.body,
        headers: { 'idempotency-key': key },
      });
      expect(replay.status).toBe(201);
      expect(replay.body.id).toBe(first.org.id);

      const count = await withTenant(h.pool, { organizationId: first.org.id }, (c) =>
        c.query(`select count(*)::int as n from organizations where slug = $1`, [first.body.slug]),
      );
      expect(count.rows[0].n).toBe(1);

      const different = await h.call('createOrganization', {
        as: admin,
        body: { ...first.body, display_name: 'Otro nombre' },
        headers: { 'idempotency-key': key },
      });
      expect(different.status).toBe(409);
      expect(different.body.code).toBe('idempotency_key_reused');
    });

    it('rechaza slug repetido, reservado o mal formado, y exige Idempotency-Key', async () => {
      const { body } = await createOrganization();
      const duplicate = await h.call('createOrganization', { as: admin, body });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.code).toBe('already_exists');

      const reserved = await h.call('createOrganization', {
        as: admin,
        body: { ...body, slug: 'admin' },
      });
      expect(reserved.status).toBe(422);

      const malformed = await h.call('createOrganization', {
        as: admin,
        body: { ...body, slug: 'Con Espacios' },
      });
      expect(malformed.status).toBe(400);
      expect(malformed.body.errors[0].pointer).toBe('/slug');

      const noKey = await h.call('createOrganization', {
        as: admin,
        body,
        headers: { 'idempotency-key': '' },
      });
      expect(noKey.status).toBe(400);
      expect(noKey.body.code).toBe('idempotency_key_required');
    });

    it('solo la administración de plataforma da de alta organizaciones', async () => {
      const { body } = await createOrganization();
      const notAdmin = await h.bearer({ scopes: ['organizations:admin'], sub: 'service:otro' });
      const response = await h.call('createOrganization', {
        as: { bearer: notAdmin },
        body: { ...body, slug: `x-${unique()}` },
      });
      expect(response.status).toBe(403);
      const anonymous = await h.call('createOrganization', { body });
      expect(anonymous.status).toBe(401);
    });

    it('edita con If-Match: la revisión obsoleta devuelve 412 y sin If-Match devuelve 400', async () => {
      const { org, session } = await ownerSession();
      const asOwner = { session };
      const ok = await h.call('updateOrganization', {
        params: { organization_id: org.id },
        as: asOwner,
        headers: { 'if-match': '"2"' },
        body: { display_name: 'Nombre nuevo' },
      });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ display_name: 'Nombre nuevo', revision: 3 });

      const stale = await h.call('updateOrganization', {
        params: { organization_id: org.id },
        as: asOwner,
        headers: { 'if-match': '"2"' },
        body: { display_name: 'Otro' },
      });
      expect(stale.status).toBe(412);
      expect(stale.body.code).toBe('stale_revision');

      const missing = await h.call('updateOrganization', {
        params: { organization_id: org.id },
        as: asOwner,
        body: { display_name: 'Otro' },
      });
      expect(missing.status).toBe(400);
    });

    it('ciclo de vida: suspender corta las sesiones; reactivar y archivar respetan la máquina de estados', async () => {
      const { org, owner, session } = await ownerSession();
      const suspendBody = { reason: 'Falta de pago' };

      const suspended = await h.call('suspendOrganization', {
        params: { organization_id: org.id },
        as: admin,
        body: suspendBody,
      });
      expect(suspended.body.state).toBe('suspended');
      expect((await h.call('getMe', { as: { session } })).status).toBe(401); // sesión revocada

      expect(
        (
          await h.call('suspendOrganization', {
            params: { organization_id: org.id },
            as: admin,
            body: suspendBody,
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await h.call('reactivateOrganization', {
            params: { organization_id: org.id },
            as: admin,
            body: suspendBody,
          })
        ).body.state,
      ).toBe('active');
      expect(
        (
          await h.call('reactivateOrganization', {
            params: { organization_id: org.id },
            as: admin,
            body: suspendBody,
          })
        ).status,
      ).toBe(409);

      expect(
        (
          await h.call('archiveOrganization', {
            params: { organization_id: org.id },
            as: admin,
            body: suspendBody,
          })
        ).body.state,
      ).toBe('archived');
      expect(
        (
          await h.call('archiveOrganization', {
            params: { organization_id: org.id },
            as: admin,
            body: suspendBody,
          })
        ).status,
      ).toBe(409);

      // Una organización archivada ya no aparece entre las activas del usuario.
      const { session: again } = await loginAs(owner);
      expect(
        (await h.call('getMe', { as: { session: again } })).body.active_organization_id,
      ).toBeNull();
    });
  });

  // ------------------------------------------------------------ PF-004, PF-005, PF-010: sesión
  describe('sesión del BFF', () => {
    it('el login por OIDC deja una cookie HttpOnly y SameSite=Lax, y una cookie CSRF legible', async () => {
      const { owner, org } = await createOrganization();
      const { response, session } = await loginAs(owner);
      expect(response.status).toBe(302);
      expect(String(response.headers.location)).toBe(`${ADMIN_ORIGIN}/`);

      const setCookie = ([] as string[]).concat(response.headers['set-cookie'] as string[]);
      const sessionCookie = setCookie.find((c) => c.startsWith('__Host-session='))!;
      expect(sessionCookie).toMatch(/HttpOnly/i);
      expect(sessionCookie).toMatch(/SameSite=Lax/i);
      expect(sessionCookie).toMatch(/Secure/i);
      expect(setCookie.find((c) => c.startsWith('__Host-csrf='))).not.toMatch(/HttpOnly/i);

      const me = await h.call('getMe', { as: { session } });
      expect(me.body).toMatchObject({
        active_organization_id: org.id,
        roles: ['org_owner'],
        email: owner.email,
      });
    });

    it('rechaza destinos de retorno fuera de la allowlist y callbacks sin intento válido', async () => {
      const evil = await h.call('startLogin', {
        query: { return_to: 'https://evil.example/robar' },
      });
      expect(evil.status).toBe(400);
      expect(evil.body.code).toBe('return_to_not_allowed');
      const smuggled = await h.call('startLogin', {
        query: { return_to: `${ADMIN_ORIGIN}@evil.example/` },
      });
      expect(smuggled.status).toBe(400);

      const noAttempt = await h.call('completeLogin', {
        query: { code: 'x', state: 'y' },
        skipConformance: true,
      });
      expect(noAttempt.status).toBe(401);

      const started = await h.call('startLogin', {});
      const wrongState = await h.call('completeLogin', {
        query: { code: 'x', state: 'otro' },
        cookies: { '__Host-oidc': started.cookies['__Host-oidc']! },
        skipConformance: true,
      });
      expect(wrongState.status).toBe(401);
      // El intento se consume aunque falle: no se puede reintentar con el mismo.
      const retried = await h.call('completeLogin', {
        query: { code: 'x', state: 'otro' },
        cookies: { '__Host-oidc': started.cookies['__Host-oidc']! },
        skipConformance: true,
      });
      expect(retried.status).toBe(401);
    });

    it('exige CSRF en las mutaciones con cookie', async () => {
      const { org, session } = await ownerSession();
      const response = await h.call('switchOrganizationContext', {
        as: { session },
        headers: { 'x-csrf-token': 'falso' },
        body: { organization_id: org.id },
      });
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('csrf_invalid');
    });

    it('rota el refresh; reutilizar la cookie anterior revoca la sesión entera', async () => {
      const { session } = await ownerSession();
      const refreshed = await h.call('refreshSession', { as: { session } });
      expect(refreshed.status).toBe(204);
      const next = {
        cookie: refreshed.cookies['__Host-session']!,
        csrf: refreshed.cookies['__Host-csrf']!,
      };
      expect(next.cookie).not.toBe(session.cookie);

      // La cookie nueva funciona y la anterior se tolera un instante (peticiones en vuelo).
      expect((await h.call('getMe', { as: { session: next } })).status).toBe(200);
      expect((await h.call('getMe', { as: { session } })).status).toBe(200);

      // Reutilizar la anterior en un refresh es una señal de robo: se revoca todo.
      const reuse = await h.call('refreshSession', { as: { session } });
      expect(reuse.status).toBe(401);
      expect(reuse.body.code).toBe('session_revoked');
      const afterwards = await h.call('getMe', { as: { session: next } });
      expect(afterwards.status).toBe(401);
    });

    it('la cookie anterior deja de valer pasada la ventana de gracia', async () => {
      const { session } = await ownerSession();
      const refreshed = await h.call('refreshSession', { as: { session } });
      h.clock.advanceSeconds(120);
      const stale = await h.call('getMe', { as: { session } });
      expect(stale.status).toBe(401);
      void refreshed;
    });

    it('cierra la sesión local y la sesión vence por inactividad', async () => {
      const { session } = await ownerSession();
      expect((await h.call('logout', { as: { session } })).status).toBe(204);
      expect((await h.call('getMe', { as: { session } })).status).toBe(401);

      const { session: idle } = await ownerSession();
      h.clock.advanceSeconds(8 * 3600 + 5);
      expect((await h.call('getMe', { as: { session: idle } })).status).toBe(401);
    });

    it('logout-all exige MFA reciente', async () => {
      const weak = await ownerSession(['pwd']);
      const denied = await h.call('logoutAll', { as: { session: weak.session } });
      expect(denied.status).toBe(403);
      expect(denied.body.code).toBe('mfa_required');

      const strong = await ownerSession(['pwd', 'mfa']);
      expect((await h.call('logoutAll', { as: { session: strong.session } })).status).toBe(204);
      expect((await h.call('getMe', { as: { session: strong.session } })).status).toBe(401);
    });

    it('lista las sesiones propias y permite revocar otra', async () => {
      const { owner, session } = await ownerSession();
      const second = (await loginAs(owner)).session;

      const listed = await h.call('listMySessions', { as: { session } });
      expect(listed.body.items.length).toBeGreaterThanOrEqual(2);
      expect(listed.body.items.filter((s: any) => s.current)).toHaveLength(1);
      expect(JSON.stringify(listed.body)).not.toContain(session.cookie.split('.')[1]!); // nunca el secreto

      const other = listed.body.items.find((s: any) => !s.current);
      expect(
        (await h.call('revokeSession', { params: { session_id: other.id }, as: { session } }))
          .status,
      ).toBe(204);
      expect((await h.call('getMe', { as: { session: second } })).status).toBe(401);
    });
  });

  // ------------------------------------------------------------ PF-002, PF-003, PF-008: miembros
  describe('invitaciones y membresías', () => {
    it('invita sin exponer ni el token ni el correo completo, y no duplica', async () => {
      const { org, session } = await ownerSession();
      const email = `nuevo-${unique()}@example.test`;
      const body = { email, roles: ['site_editor'], expires_at: iso(DAY, h.clock.now().getTime()) };
      const key = randomUUID();
      const sentBefore = h.notifier.sent.length;

      const created = await h.call('createInvitation', {
        params: { organization_id: org.id },
        as: { session },
        body,
        headers: { 'idempotency-key': key },
      });
      expect(created.status).toBe(201);
      expect(created.body.email_masked).toBe(`n***@example.test`);
      expect(JSON.stringify(created.body)).not.toContain(email);
      expect(JSON.stringify(created.body)).not.toMatch(/token/i);
      expect(h.notifier.sent.length).toBe(sentBefore + 1);
      expect(h.notifier.sent.at(-1)).toMatchObject({ to: email });

      const replay = await h.call('createInvitation', {
        params: { organization_id: org.id },
        as: { session },
        body,
        headers: { 'idempotency-key': key },
      });
      expect(replay.body.id).toBe(created.body.id);
      expect(h.notifier.sent.length).toBe(sentBefore + 1); // una repetición no reenvía el correo

      const duplicate = await h.call('createInvitation', {
        params: { organization_id: org.id },
        as: { session },
        body,
      });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.code).toBe('already_exists');

      const tooLong = await h.call('createInvitation', {
        params: { organization_id: org.id },
        as: { session },
        body: {
          ...body,
          email: `otro-${unique()}@example.test`,
          expires_at: iso(8 * DAY, h.clock.now().getTime()),
        },
      });
      expect(tooLong.status).toBe(422);
    });

    it('solo la persona invitada puede aceptar, con correo verificado, y una sola vez', async () => {
      const { org, session } = await ownerSession();
      const member = await addMember(org.id, session, ['site_editor']);
      expect(member.membership).toMatchObject({
        state: 'active',
        roles: ['site_editor'],
        organization_id: org.id,
      });

      const replayed = await h.call('acceptInvitation', {
        params: { token: member.token },
        as: { session: member.session },
      });
      expect(replayed.status).toBe(409);

      // Otra persona, con otro correo, no puede usar el token.
      const stranger = await createOrganization();
      const intruder = (await loginAs(stranger.owner)).session;
      const invitedAgain = await h.call('createInvitation', {
        params: { organization_id: org.id },
        as: { session },
        body: {
          email: `solo-${unique()}@example.test`,
          roles: ['report_viewer'],
          expires_at: iso(DAY, h.clock.now().getTime()),
        },
      });
      expect(invitedAgain.status).toBe(201);
      const token = decodeURIComponent(
        h.notifier.sent.at(-1)!.acceptUrl.split('/invitations/')[1]!,
      );
      expect(
        (await h.call('acceptInvitation', { params: { token }, as: { session: intruder } })).status,
      ).toBe(404);

      // Un correo no verificado por el proveedor no sirve para aceptar.
      const unverified = unique();
      await h.call('createInvitation', {
        params: { organization_id: org.id },
        as: { session },
        body: {
          email: `u-${unverified}@example.test`,
          roles: ['report_viewer'],
          expires_at: iso(DAY, h.clock.now().getTime()),
        },
      });
      const unverifiedToken = decodeURIComponent(
        h.notifier.sent.at(-1)!.acceptUrl.split('/invitations/')[1]!,
      );
      const { session: weak } = await loginAs(
        { subject: `u-${unverified}`, email: `u-${unverified}@example.test` },
        ['pwd'],
        false,
      );
      expect(
        (
          await h.call('acceptInvitation', {
            params: { token: unverifiedToken },
            as: { session: weak },
          })
        ).status,
      ).toBe(404);
    });

    it('rechazar una invitación solo exige el token, y una vencida no se acepta', async () => {
      const { org, session } = await ownerSession();
      await h.call('createInvitation', {
        params: { organization_id: org.id },
        as: { session },
        body: {
          email: `r-${unique()}@example.test`,
          roles: ['report_viewer'],
          expires_at: iso(DAY, h.clock.now().getTime()),
        },
      });
      const token = decodeURIComponent(
        h.notifier.sent.at(-1)!.acceptUrl.split('/invitations/')[1]!,
      );
      expect((await h.call('declineInvitation', { params: { token } })).status).toBe(204);
      expect((await h.call('declineInvitation', { params: { token } })).status).toBe(409);
      expect(
        (await h.call('declineInvitation', { params: { token: `${org.id}.${'x'.repeat(30)}` } }))
          .status,
      ).toBe(404);

      const email = `v-${unique()}@example.test`;
      await h.call('createInvitation', {
        params: { organization_id: org.id },
        as: { session },
        body: { email, roles: ['report_viewer'], expires_at: iso(60_000, h.clock.now().getTime()) },
      });
      const expiring = decodeURIComponent(
        h.notifier.sent.at(-1)!.acceptUrl.split('/invitations/')[1]!,
      );
      h.clock.advanceSeconds(120);
      const { session: invitee } = await loginAs({ subject: `v-${unique()}`, email });
      const late = await h.call('acceptInvitation', {
        params: { token: expiring },
        as: { session: invitee },
      });
      expect(late.status).toBe(409);
      expect(late.body.code).toBe('invitation_expired');
    });

    it('lista miembros con paginación por cursor, filtros y correo solo para administradores', async () => {
      const { org, session } = await ownerSession();
      await addMember(org.id, session, ['site_editor']);
      const reviewer = await addMember(org.id, session, ['report_viewer']);

      const all = await h.call('listMemberships', {
        params: { organization_id: org.id },
        as: { session },
      });
      expect(all.body.items).toHaveLength(3);
      expect(all.body.items.every((m: any) => typeof m.email === 'string')).toBe(true);

      const first = await h.call('listMemberships', {
        params: { organization_id: org.id },
        query: { limit: 2 },
        as: { session },
      });
      expect(first.body.items).toHaveLength(2);
      expect(first.body.next_cursor).toBeTruthy();
      const second = await h.call('listMemberships', {
        params: { organization_id: org.id },
        query: { limit: 2, cursor: first.body.next_cursor },
        as: { session },
      });
      expect(second.body.items).toHaveLength(1);
      expect(second.body.next_cursor).toBeNull();

      const editors = await h.call('listMemberships', {
        params: { organization_id: org.id },
        query: { role: 'site_editor' },
        as: { session },
      });
      expect(editors.body.items).toHaveLength(1);

      // Un miembro sin organizations:admin no ve la lista.
      expect(
        (
          await h.call('listMemberships', {
            params: { organization_id: org.id },
            as: { session: reviewer.session },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await h.call('listMemberships', {
            params: { organization_id: org.id },
            query: { cursor: '###' },
            as: { session },
          })
        ).status,
      ).toBe(400);
    });

    it('cambia roles con If-Match y nunca deja la organización sin owner', async () => {
      const { org, session } = await ownerSession();
      const editor = await addMember(org.id, session, ['site_editor']);
      const membershipId = editor.membership.id;

      const changed = await h.call('updateMembership', {
        params: { membership_id: membershipId },
        as: { session },
        headers: { 'if-match': '"1"' },
        body: { roles: ['event_manager'] },
      });
      expect(changed.status).toBe(200);
      expect(changed.body).toMatchObject({ roles: ['event_manager'], revision: 2 });

      const stale = await h.call('updateMembership', {
        params: { membership_id: membershipId },
        as: { session },
        headers: { 'if-match': '"1"' },
        body: { roles: ['report_viewer'] },
      });
      expect(stale.status).toBe(412);

      // Intentar quitarle el owner al único owner, o suspenderlo, devuelve 409.
      const list = await h.call('listMemberships', {
        params: { organization_id: org.id },
        query: { role: 'org_owner' },
        as: { session },
      });
      const ownerMembership = list.body.items[0];
      const demote = await h.call('updateMembership', {
        params: { membership_id: ownerMembership.id },
        as: { session },
        headers: { 'if-match': `"${ownerMembership.revision}"` },
        body: { roles: ['site_editor'] },
      });
      expect(demote.status).toBe(409);
      expect(demote.body.code).toBe('last_owner_required');
      const suspend = await h.call('updateMembership', {
        params: { membership_id: ownerMembership.id },
        as: { session },
        headers: { 'if-match': `"${ownerMembership.revision}"` },
        body: { state: 'suspended' },
      });
      expect(suspend.body.code).toBe('last_owner_required');

      // Con un segundo owner el traspaso sí es posible.
      const promote = await h.call('updateMembership', {
        params: { membership_id: membershipId },
        as: { session },
        headers: { 'if-match': '"2"' },
        body: { roles: ['org_owner'] },
      });
      expect(promote.status).toBe(200);
      const demoteNow = await h.call('updateMembership', {
        params: { membership_id: ownerMembership.id },
        as: { session },
        headers: { 'if-match': `"${ownerMembership.revision}"` },
        body: { roles: ['site_editor'] },
      });
      expect(demoteNow.status).toBe(200);
    });

    it('solo un owner puede otorgar el rol de owner', async () => {
      const { org, session } = await ownerSession();
      const securityAdmin = await addMember(org.id, session, ['security_admin']);
      const editor = await addMember(org.id, session, ['site_editor']);

      const escalate = await h.call('updateMembership', {
        params: { membership_id: editor.membership.id },
        as: { session: securityAdmin.session },
        headers: { 'if-match': '"1"' },
        body: { roles: ['org_owner'] },
      });
      expect(escalate.status).toBe(403);
      const invite = await h.call('createInvitation', {
        params: { organization_id: org.id },
        as: { session: securityAdmin.session },
        body: {
          email: `o-${unique()}@example.test`,
          roles: ['org_owner'],
          expires_at: iso(DAY, h.clock.now().getTime()),
        },
      });
      expect(invite.status).toBe(403);
    });

    it('suspender a un miembro corta su sesión al instante', async () => {
      const { org, session } = await ownerSession();
      const editor = await addMember(org.id, session, ['site_editor']);
      expect(
        (
          await h.call('getOrganization', {
            params: { organization_id: org.id },
            as: { session: editor.session },
          })
        ).status,
      ).toBe(200);

      const suspended = await h.call('updateMembership', {
        params: { membership_id: editor.membership.id },
        as: { session },
        headers: { 'if-match': '"1"' },
        body: { state: 'suspended' },
      });
      expect(suspended.body.state).toBe('suspended');
      expect(
        (
          await h.call('getOrganization', {
            params: { organization_id: org.id },
            as: { session: editor.session },
          })
        ).status,
      ).toBe(401);
    });
  });

  // ------------------------------------------------------------ aislamiento entre organizaciones
  describe('aislamiento entre organizaciones', () => {
    it('una organización no ve ni modifica a otra, y responde 404 igual que si no existiera', async () => {
      const a = await ownerSession();
      const b = await ownerSession();
      const asA = { session: a.session };

      expect(
        (await h.call('getOrganization', { params: { organization_id: b.org.id }, as: asA }))
          .status,
      ).toBe(404);
      expect(
        (await h.call('listMemberships', { params: { organization_id: b.org.id }, as: asA }))
          .status,
      ).toBe(404);
      expect(
        (await h.call('listAuditEvents', { params: { organization_id: b.org.id }, as: asA }))
          .status,
      ).toBe(404);
      expect(
        (await h.call('getOrganization', { params: { organization_id: randomUUID() }, as: asA }))
          .status,
      ).toBe(404);

      const bMembers = await h.call('listMemberships', {
        params: { organization_id: b.org.id },
        as: { session: b.session },
      });
      const foreign = await h.call('updateMembership', {
        params: { membership_id: bMembers.body.items[0].id },
        as: asA,
        headers: { 'if-match': '"1"' },
        body: { roles: ['site_editor'] },
      });
      expect(foreign.status).toBe(404);
    });

    it('un token de máquina de una organización no actúa sobre otra', async () => {
      const a = await createOrganization();
      const b = await createOrganization();
      const tokenA = await h.bearer({
        scopes: ['organizations:admin'],
        organizationId: a.org.id,
        sub: 'service:a',
      });
      expect(
        (
          await h.call('listMemberships', {
            params: { organization_id: a.org.id },
            as: { bearer: tokenA },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await h.call('listMemberships', {
            params: { organization_id: b.org.id },
            as: { bearer: tokenA },
          })
        ).status,
      ).toBe(404);
    });

    it('un cuerpo con organization_id ajeno se rechaza: el tenant sale de la sesión', async () => {
      const a = await ownerSession();
      const b = await ownerSession();
      const response = await h.call('switchOrganizationContext', {
        as: { session: a.session },
        body: { organization_id: b.org.id },
      });
      expect(response.status).toBe(404); // no es miembro de B

      const extra = await h.call('updateOrganization', {
        params: { organization_id: a.org.id },
        as: { session: a.session },
        headers: { 'if-match': '"2"' },
        body: { display_name: 'x', organization_id: b.org.id },
        skipConformance: true,
      });
      expect(extra.status).toBe(400);
    });
  });

  // ------------------------------------------------------------ PF-011: cuentas de servicio
  describe('cuentas de servicio', () => {
    const body = () => ({
      name: `svc-${unique()}`,
      auth_method: 'client_secret',
      scopes: ['sites:write'],
      audiences: ['content-api'],
      expires_at: iso(30 * DAY, Date.now()),
    });

    it('exige MFA reciente y no delega scopes de plataforma ni superiores a los propios', async () => {
      const weak = await ownerSession(['pwd']);
      const noMfa = await h.call('createServiceAccount', {
        params: { organization_id: weak.org.id },
        as: { session: weak.session },
        body: body(),
      });
      expect(noMfa.status).toBe(403);
      expect(noMfa.body.code).toBe('mfa_required');

      const { org, session } = await ownerSession(['pwd', 'mfa']);
      const platformScope = await h.call('createServiceAccount', {
        params: { organization_id: org.id },
        as: { session },
        body: { ...body(), scopes: ['platform:admin'] },
      });
      expect(platformScope.status).toBe(422);

      const securityAdmin = await addMember(org.id, session, ['security_admin']);
      const beyond = await h.call('createServiceAccount', {
        params: { organization_id: org.id },
        as: { session: securityAdmin.session },
        body: { ...body(), scopes: ['sites:publish'] },
      });
      expect(beyond.status).toBe(422);
    });

    it('muestra el secreto una sola vez, rota con solapamiento y revoca', async () => {
      const { org, session } = await ownerSession(['pwd', 'mfa']);
      const key = randomUUID();
      const payload = body();

      const created = await h.call('createServiceAccount', {
        params: { organization_id: org.id },
        as: { session },
        body: payload,
        headers: { 'idempotency-key': key },
      });
      expect(created.status).toBe(201);
      expect(created.body.client_secret).toMatch(/^[A-Za-z0-9_-]{40,}$/);
      expect(created.headers['cache-control']).toBe('no-store');

      const replay = await h.call('createServiceAccount', {
        params: { organization_id: org.id },
        as: { session },
        body: payload,
        headers: { 'idempotency-key': key },
      });
      expect(replay.body.id).toBe(created.body.id);
      expect(replay.body.client_secret).toBeNull(); // el secreto no se repite

      const { rows } = await withTenant(h.pool, { organizationId: org.id }, (c) =>
        c.query(`select secret_hash from service_credentials where service_account_id = $1`, [
          created.body.id,
        ]),
      );
      expect(rows[0].secret_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(rows[0].secret_hash).not.toBe(created.body.client_secret);

      const rotated = await h.call('rotateServiceAccount', {
        params: { service_account_id: created.body.id },
        as: { session },
        body: { expires_at: iso(60 * DAY, Date.now()) },
      });
      expect(rotated.status).toBe(201);
      expect(rotated.body.client_secret).not.toBe(created.body.client_secret);

      const revoked = await h.call('revokeServiceAccount', {
        params: { service_account_id: created.body.id },
        as: { session },
        body: { reason: 'Credencial expuesta' },
      });
      expect(revoked.body.state).toBe('revoked');
      expect(
        (
          await h.call('rotateServiceAccount', {
            params: { service_account_id: created.body.id },
            as: { session },
            body: { expires_at: iso(DAY, Date.now()) },
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await h.call('revokeServiceAccount', {
            params: { service_account_id: randomUUID() },
            as: { session },
            body: { reason: 'No existe' },
          })
        ).status,
      ).toBe(404);
    });
  });

  // ------------------------------------------------------------ PF-021, PF-022: dominios
  describe('dominios', () => {
    it('registra, verifica y resuelve un dominio con caché pública', async () => {
      const { org, session } = await ownerSession();
      const siteId = randomUUID();
      const hostname = `eventos.ejemplo-${unique()}.edu.pe`;

      const registered = await h.call('registerDomain', {
        params: { site_id: siteId },
        as: { session },
        body: { hostname: hostname.toUpperCase(), verification_method: 'dns_txt', primary: true },
      });
      expect(registered.status).toBe(201);
      expect(registered.body).toMatchObject({
        hostname,
        state: 'pending',
        organization_id: org.id,
      });
      expect(registered.body.challenge.name).toBe(`_incubaunas-challenge.${hostname}`);

      expect(
        (
          await h.call('registerDomain', {
            params: { site_id: siteId },
            as: { session },
            body: { hostname, verification_method: 'dns_txt' },
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await h.call('registerDomain', {
            params: { site_id: siteId },
            as: { session },
            body: { hostname: 'panel.internal', verification_method: 'dns_txt' },
          })
        ).status,
      ).toBe(422);

      // Sin el desafío resuelto la verificación falla y el dominio queda en `failed`.
      const failed = await h.call('verifyDomain', {
        params: { domain_id: registered.body.id },
        as: { session },
      });
      expect(failed.status).toBe(409);
      expect(failed.body.code).toBe('domain_verification_failed');
      expect((await h.call('resolveHost', { params: { hostname } })).status).toBe(404);

      h.domainVerifier.controlled.add(hostname);
      const verified = await h.call('verifyDomain', {
        params: { domain_id: registered.body.id },
        as: { session },
      });
      expect(verified.status).toBe(200);
      expect(verified.body.state).toBe('active');

      const resolved = await h.call('resolveHost', { params: { hostname } });
      expect(resolved.body).toEqual({ hostname, site_id: siteId, organization_id: org.id });
      expect(String(resolved.headers['cache-control'])).toContain('s-maxage=300');
      expect(String(resolved.headers['surrogate-key'])).toContain(`host:${hostname}`);
      const cached = await h.call('resolveHost', {
        params: { hostname },
        headers: { 'if-none-match': String(resolved.headers.etag) },
      });
      expect(cached.status).toBe(304);

      const { rows } = await h.pool.query(
        `select topic from outbox where organization_id = $1 and topic = 'platform.domain.activated.v1'`,
        [org.id],
      );
      expect(rows).toHaveLength(1);
    });

    it('otra organización no puede verificar ni tomar el dominio', async () => {
      const a = await ownerSession();
      const b = await ownerSession();
      const hostname = `a-${unique()}.universidad.edu.pe`;
      const registered = await h.call('registerDomain', {
        params: { site_id: randomUUID() },
        as: { session: a.session },
        body: { hostname, verification_method: 'http_file' },
      });
      expect(
        (
          await h.call('verifyDomain', {
            params: { domain_id: registered.body.id },
            as: { session: b.session },
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await h.call('registerDomain', {
            params: { site_id: randomUUID() },
            as: { session: b.session },
            body: { hostname, verification_method: 'http_file' },
          })
        ).status,
      ).toBe(409);
    });
  });

  // ------------------------------------------------------------ PF-012: auditoría y relay
  describe('auditoría y publicación de eventos', () => {
    it('deja rastro de las acciones sin datos personales y solo la ve su organización', async () => {
      const { org, session, owner } = await ownerSession();
      const email = `aud-${unique()}@example.test`;
      await h.call('createInvitation', {
        params: { organization_id: org.id },
        as: { session },
        body: { email, roles: ['report_viewer'], expires_at: iso(DAY, h.clock.now().getTime()) },
      });

      const events = await h.call('listAuditEvents', {
        params: { organization_id: org.id },
        as: { session },
      });
      const actions = events.body.items.map((e: any) => e.action);
      expect(actions).toEqual(
        expect.arrayContaining(['organization.created', 'invitation.created']),
      );
      expect(JSON.stringify(events.body)).not.toContain(email);
      expect(JSON.stringify(events.body)).not.toContain(owner.email);

      const filtered = await h.call('listAuditEvents', {
        params: { organization_id: org.id },
        query: { action: 'invitation.created' },
        as: { session },
      });
      expect(filtered.body.items.every((e: any) => e.action === 'invitation.created')).toBe(true);
    });

    it('el relay publica los eventos del outbox con el contrato y sin datos personales', async () => {
      const { org } = await ownerSession();
      const bus = new InMemoryEventBus();
      await new OutboxRelay(h.pool, bus, { clock: h.clock, batchSize: 500 }).tick();

      const mine = bus.published.filter((m) => m.organization_id === org.id);
      expect(mine.map((m) => m.topic).sort()).toEqual([
        'platform.membership.changed.v1',
        'platform.organization.lifecycle_changed.v1',
      ]);
      expect(JSON.stringify(mine)).not.toMatch(/@example\.test/);
    });
  });
});
