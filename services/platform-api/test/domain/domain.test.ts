import { describe, expect, it } from 'vitest';
import { AppError } from '@incubaunas/shared-kernel';
import { Invitation, MAX_INVITATION_TTL_MS } from '../../src/domain/invitation.js';
import { Membership, assertOwnerRemains } from '../../src/domain/membership.js';
import { Organization } from '../../src/domain/organization.js';
import { assertEmail, assertSlug, assertTimezone } from '../../src/domain/value-objects.js';
import { assertHostname } from '../../src/application/domains.js';

const ID = '0192f3a0-0000-7000-8000-0000000000a1';
const now = new Date('2026-11-04T12:00:00Z');

const org = () =>
  Organization.provision(
    {
      id: ID,
      slug: 'incubaunas',
      displayName: 'IncubaUNAS',
      timezone: 'America/Lima',
      locale: 'es-PE',
    },
    now,
  );

const expectCode = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return;
  }
  throw new Error(`Se esperaba el error ${code}`);
};

describe('Organization (máquina de estados)', () => {
  it('nace en provisioning y recorre solo los arcos permitidos', () => {
    const o = org();
    expect(o.state).toBe('provisioning');
    o.activate(now);
    o.suspend(now);
    o.reactivate(now);
    o.archive(now);
    expect(o.state).toBe('archived');
  });

  it.each([
    ['provisioning → suspended', (o: Organization) => o.suspend(now)],
    ['provisioning → archived', (o: Organization) => o.archive(now)],
    ['active → active', (o: Organization) => (o.activate(now), o.activate(now))],
    ['active → reactivar', (o: Organization) => (o.activate(now), o.reactivate(now))],
    [
      'archived → cualquiera',
      (o: Organization) => (o.activate(now), o.archive(now), o.reactivate(now)),
    ],
  ])('rechaza %s con invalid_state_transition', (_name, act) => {
    expectCode(() => act(org()), 'invalid_state_transition');
  });

  it('una organización archivada es de solo lectura', () => {
    const o = org();
    o.activate(now);
    o.archive(now);
    expectCode(() => o.edit({ displayName: 'Otro nombre' }, now), 'invalid_state_transition');
  });

  it('valida slug, zona horaria y correo', () => {
    expectCode(() => assertSlug('Mayúsculas'), 'validation_failed');
    expectCode(() => assertSlug('admin'), 'validation_failed'); // reservado
    expectCode(() => assertSlug('-empieza-con-guion'), 'validation_failed');
    expectCode(() => assertTimezone('Marte/Olympus'), 'validation_failed');
    expectCode(() => assertEmail('no-es-correo'), 'validation_failed');
    expect(assertEmail('  Ana@Example.ORG ')).toBe('ana@example.org');
  });
});

describe('Membership', () => {
  const owner = () =>
    Membership.join(
      { id: ID, organizationId: ID, userId: ID, roles: ['org_owner', 'org_owner'] },
      now,
    );

  it('quita roles duplicados y rechaza roles inexistentes o vacíos', () => {
    expect(owner().snapshot.roles).toEqual(['org_owner']);
    expectCode(
      () => Membership.join({ id: ID, organizationId: ID, userId: ID, roles: ['dios'] }, now),
      'validation_failed',
    );
    expectCode(
      () => Membership.join({ id: ID, organizationId: ID, userId: ID, roles: [] }, now),
      'validation_failed',
    );
  });

  it('revocada es terminal: no se reactiva ni se le cambian los roles', () => {
    const m = owner();
    m.revoke(now);
    expectCode(() => m.reactivate(now), 'invalid_state_transition');
    expectCode(() => m.changeRoles(['site_editor'], now), 'invalid_state_transition');
  });

  it('suspender y reactivar son reversibles', () => {
    const m = owner();
    m.suspend(now);
    expect(m.isActiveOwner).toBe(false);
    m.reactivate(now);
    expect(m.isActiveOwner).toBe(true);
  });

  it('no se puede perder al último owner activo', () => {
    expectCode(
      () => assertOwnerRemains({ wasActiveOwner: true, isActiveOwner: false, activeOwners: 1 }),
      'last_owner_required',
    );
    expect(() =>
      assertOwnerRemains({ wasActiveOwner: true, isActiveOwner: false, activeOwners: 2 }),
    ).not.toThrow();
    expect(() =>
      assertOwnerRemains({ wasActiveOwner: false, isActiveOwner: false, activeOwners: 1 }),
    ).not.toThrow();
  });
});

describe('Invitation', () => {
  const issue = (ttlMs = 60_000) =>
    Invitation.issue(
      {
        id: ID,
        organizationId: ID,
        emailCiphertext: 'c',
        emailBlindIndex: 'idx',
        roles: ['site_editor'],
        tokenHash: 'h',
        expiresAt: new Date(now.getTime() + ttlMs),
      },
      now,
    );

  it('exige una vigencia futura de 7 días como máximo', () => {
    expectCode(() => issue(-1000), 'validation_failed');
    expectCode(() => issue(MAX_INVITATION_TTL_MS + 1), 'validation_failed');
    expect(() => issue(MAX_INVITATION_TTL_MS)).not.toThrow();
  });

  it('solo la persona invitada puede aceptar, y solo una vez', () => {
    const inv = issue();
    expectCode(() => inv.accept({ userId: ID, emailBlindIndex: 'otro' }, now), 'not_found');
    inv.accept({ userId: ID, emailBlindIndex: 'idx' }, now);
    expect(inv.state).toBe('accepted');
    expectCode(
      () => inv.accept({ userId: ID, emailBlindIndex: 'idx' }, now),
      'invitation_not_pending',
    );
  });

  it('una invitación vencida no se puede aceptar ni rechazar', () => {
    const late = new Date(now.getTime() + 120_000);
    expectCode(
      () => issue().accept({ userId: ID, emailBlindIndex: 'idx' }, late),
      'invitation_expired',
    );
    expectCode(() => issue().decline(late), 'invitation_expired');
  });
});

describe('hostnames', () => {
  it('normaliza y acepta dominios públicos', () => {
    expect(assertHostname(' Eventos.Universidad.edu.PE. ')).toBe('eventos.universidad.edu.pe');
  });

  it.each([
    'localhost',
    'servidor.local',
    '10.0.0.1',
    'sin-punto',
    '-malo.com',
    'a'.repeat(64) + '.com',
    'x.internal',
    'ejemplo.test',
  ])('rechaza %s', (hostname) => expectCode(() => assertHostname(hostname), 'validation_failed'));
});
