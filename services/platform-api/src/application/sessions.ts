import {
  AppError,
  hmacHex,
  notFound,
  safeEqual,
  sha256Hex,
  unauthenticated,
  type Clock,
  type IdGenerator,
  type Uuid,
} from '@incubaunas/shared-kernel';
import { Authorization, type RequestContext, type Restriction } from '@incubaunas/tenancy';
import type { Role } from '@incubaunas/tenancy';
import { assertEmail } from '../domain/value-objects.js';
import { recordAudit } from './deps.js';
import type {
  OidcProvider,
  PiiProtector,
  Repositories,
  SessionRecord,
  TokenGenerator,
  UnitOfWork,
} from './ports.js';

export interface SessionPolicy {
  idleTtlMs: number;
  absoluteTtlMs: number;
  loginAttemptTtlMs: number;
  /** Ventana en la que un cliente con la cookie anterior todavía se acepta tras una rotación. */
  rotationGraceMs: number;
  /** Orígenes a los que se puede volver después del login. */
  returnToOrigins: readonly string[];
}

export const DEFAULT_SESSION_POLICY: Omit<SessionPolicy, 'returnToOrigins'> = {
  idleTtlMs: 8 * 60 * 60 * 1000,
  absoluteTtlMs: 30 * 24 * 60 * 60 * 1000,
  loginAttemptTtlMs: 10 * 60 * 1000,
  rotationGraceMs: 30 * 1000,
};

export interface SessionServiceDeps {
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  tokens: TokenGenerator;
  pii: PiiProtector;
  oidc: OidcProvider;
  policy: SessionPolicy;
  redirectUri: string;
  /** Clave para derivar el token CSRF de cada sesión. */
  csrfKey: string;
}

export interface IssuedSession {
  /** Valor de la cookie `id.secreto`. */
  cookieValue: string;
  sessionId: Uuid;
  csrfToken: string;
  maxAgeSeconds: number;
}

export interface AuthenticatedSession {
  context: RequestContext;
  sessionId: Uuid;
  csrfToken: string;
}

const COOKIE_SEPARATOR = '.';

function parseCookie(value: string | undefined): { id: Uuid; secret: string } | null {
  if (!value) return null;
  const index = value.indexOf(COOKIE_SEPARATOR);
  if (index < 1) return null;
  const id = value.slice(0, index);
  const secret = value.slice(index + 1);
  return /^[0-9a-f-]{36}$/i.test(id) && secret.length >= 20 ? { id, secret } : null;
}

/**
 * Sesión de aplicación del BFF (PF-004, PF-005, PF-009, PF-010). El navegador solo guarda un
 * identificador opaco; el estado, los permisos y la revocación viven en el servidor.
 */
export class SessionService {
  constructor(private readonly deps: SessionServiceDeps) {}

  csrfTokenFor(sessionId: Uuid): string {
    return hmacHex(this.deps.csrfKey, `csrf:${sessionId}`);
  }

  // ------------------------------------------------------------ login
  /** `return_to` debe pertenecer a un origen de la allowlist; si no, se rechaza (open redirect). */
  resolveReturnTo(candidate: string | undefined): string {
    const [fallback] = this.deps.policy.returnToOrigins;
    if (!candidate) return `${fallback}/`;
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new AppError('return_to_not_allowed', 400, 'El destino de retorno no es válido.');
    }
    const allowed =
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      !url.username &&
      !url.password &&
      this.deps.policy.returnToOrigins.includes(url.origin);
    if (!allowed)
      throw new AppError('return_to_not_allowed', 400, 'El destino de retorno no está permitido.');
    return url.toString();
  }

  async beginLogin(
    returnTo: string | undefined,
  ): Promise<{ redirectUrl: string; attemptToken: string; maxAgeSeconds: number }> {
    const { uow, clock, ids, tokens, pii, oidc, policy, redirectUri } = this.deps;
    const destination = this.resolveReturnTo(returnTo);
    const authorization = await oidc.createAuthorization({ redirectUri });
    const attemptToken = tokens.generate();
    const now = clock.now();

    await uow.run({}, (r) =>
      r.loginAttempts.insert({
        id: ids.next(),
        attemptHash: sha256Hex(attemptToken),
        state: authorization.state,
        nonce: authorization.nonce,
        codeVerifierCiphertext: pii.encrypt(authorization.codeVerifier),
        returnTo: destination,
        createdAt: now,
        expiresAt: new Date(now.getTime() + policy.loginAttemptTtlMs),
      }),
    );
    return {
      redirectUrl: authorization.url,
      attemptToken,
      maxAgeSeconds: Math.floor(policy.loginAttemptTtlMs / 1000),
    };
  }

  async completeLogin(input: {
    attemptToken: string | undefined;
    callbackUrl: URL;
    requestId: string;
    deviceLabel?: string | null;
    ipPseudonym?: string | null;
  }): Promise<IssuedSession & { returnTo: string }> {
    const { uow, clock, oidc, pii } = this.deps;
    if (!input.attemptToken)
      throw new AppError(
        'unauthenticated',
        401,
        'El intento de inicio de sesión no existe o venció.',
      );

    const attempt = await uow.run({}, (r) =>
      r.loginAttempts.consume(sha256Hex(input.attemptToken!), clock.now()),
    );
    if (!attempt)
      throw new AppError(
        'unauthenticated',
        401,
        'El intento de inicio de sesión no existe o venció.',
      );

    let claims;
    try {
      claims = await oidc.completeAuthorization({
        callbackUrl: input.callbackUrl,
        expectedState: attempt.state,
        nonce: attempt.nonce,
        codeVerifier: pii.decrypt(attempt.codeVerifierCiphertext),
      });
    } catch {
      // Nunca se explica por qué falló la validación del proveedor.
      throw new AppError('unauthenticated', 401, 'No se pudo completar el inicio de sesión.');
    }

    const user = await uow.run({}, (r) => this.upsertUser(r, claims));

    const session = await uow.run({ userId: user.id }, async (r) => {
      const now = clock.now();
      const memberships = await r.memberships.listActiveForUser(user.id);
      // Con una única organización se activa sola; con varias la persona elige (PF-009).
      const organizationId = memberships.length === 1 ? memberships[0]!.organization.id : null;
      const issued = this.newSession(
        user.id,
        organizationId,
        claims.amr,
        claims.authTime ?? now,
        now,
        input,
      );
      await r.sessions.insert(issued.record);
      // El inicio de sesión no pertenece a un tenant: se audita sin organización.
      await recordAudit(
        r,
        this.deps,
        { actor: { type: 'user', id: user.id }, requestId: input.requestId },
        {
          organizationId: null,
          action: 'auth.login',
          target: { type: 'session', id: issued.record.id },
          outcome: 'success',
        },
      );
      return issued.session;
    });
    return { ...session, returnTo: attempt.returnTo };
  }

  // ------------------------------------------------------------ autenticación por petición
  async authenticate(
    cookieValue: string | undefined,
    requestId: string,
  ): Promise<AuthenticatedSession | null> {
    const parsed = parseCookie(cookieValue);
    if (!parsed) return null;
    const { uow, clock } = this.deps;
    const now = clock.now();

    const session = await uow.run({}, (r) => r.sessions.findById(parsed.id));
    if (!session) return null;
    this.assertUsable(session, now);

    const presented = sha256Hex(parsed.secret);
    if (!safeEqual(presented, session.secretHash)) {
      const withinGrace =
        session.previousSecretHash !== null &&
        safeEqual(presented, session.previousSecretHash) &&
        now.getTime() - session.lastUsedAt.getTime() <= this.deps.policy.rotationGraceMs;
      if (!withinGrace) {
        await this.revokeAsReuse(session, requestId, now);
        throw new AppError(
          'session_revoked',
          401,
          'La sesión se cerró por seguridad. Inicia sesión de nuevo.',
        );
      }
    }

    // Renueva la ventana inactiva como máximo una vez por minuto, para no escribir en cada petición.
    if (now.getTime() - session.lastUsedAt.getTime() > 60_000) {
      await uow.run({}, (r) =>
        r.sessions.touch(
          session.id,
          now,
          new Date(
            Math.min(
              now.getTime() + this.deps.policy.idleTtlMs,
              session.absoluteExpiresAt.getTime(),
            ),
          ),
        ),
      );
    }

    return {
      sessionId: session.id,
      csrfToken: this.csrfTokenFor(session.id),
      context: await this.buildContext(session, requestId),
    };
  }

  private async buildContext(session: SessionRecord, requestId: string): Promise<RequestContext> {
    const { uow, clock } = this.deps;
    let roles: Role[] = [];
    let restrictions: Restriction[] = [];
    let organizationId: Uuid | null = null;

    if (session.organizationId) {
      // La membresía y la organización se consultan en cada petición: suspender surte efecto al instante.
      const found = await uow.run(
        { organizationId: session.organizationId, userId: session.userId },
        async (r) => {
          const [organization, membership] = await Promise.all([
            r.organizations.findById(session.organizationId!),
            r.memberships.findCurrentForUser(session.organizationId!, session.userId),
          ]);
          return organization?.state === 'active' && membership?.state === 'active'
            ? membership
            : null;
        },
      );
      if (found) {
        organizationId = session.organizationId;
        roles = found.snapshot.roles;
        restrictions = found.snapshot.restrictions;
      }
    }

    return {
      requestId,
      organizationId,
      userId: session.userId,
      sessionId: session.id,
      actor: { type: 'user', id: session.userId },
      authz: new Authorization({
        roles,
        restrictions,
        authTime: session.authTime,
        amr: session.amr,
        clock,
      }),
    };
  }

  // ------------------------------------------------------------ rotación y cierre
  async refresh(cookieValue: string | undefined, requestId: string): Promise<IssuedSession> {
    const parsed = parseCookie(cookieValue);
    if (!parsed) throw unauthenticated();
    const { uow, clock, tokens, policy } = this.deps;
    const now = clock.now();

    const session = await uow.run({}, (r) => r.sessions.findById(parsed.id));
    if (!session) throw unauthenticated();
    this.assertUsable(session, now);

    // Aquí no hay período de gracia: reutilizar un secreto ya rotado revoca la sesión entera.
    if (!safeEqual(sha256Hex(parsed.secret), session.secretHash)) {
      await this.revokeAsReuse(session, requestId, now);
      throw new AppError(
        'session_revoked',
        401,
        'La sesión se cerró por seguridad. Inicia sesión de nuevo.',
      );
    }

    const secret = tokens.generate();
    const idleExpiresAt = new Date(
      Math.min(now.getTime() + policy.idleTtlMs, session.absoluteExpiresAt.getTime()),
    );
    await uow.run({}, (r) =>
      r.sessions.rotate(session.id, sha256Hex(secret), session.secretHash, now, idleExpiresAt),
    );
    return this.issued(session.id, secret, session.absoluteExpiresAt, now);
  }

  async logout(sessionId: Uuid, requestId: string): Promise<void> {
    const { uow, clock } = this.deps;
    await uow.run({}, async (r) => {
      await r.sessions.revoke(sessionId, clock.now(), 'logout');
      await recordAudit(
        r,
        this.deps,
        { actor: { type: 'system', id: 'system:bff' }, requestId },
        {
          organizationId: null,
          action: 'auth.logout',
          target: { type: 'session', id: sessionId },
          outcome: 'success',
        },
      );
    });
  }

  async logoutAll(ctx: RequestContext): Promise<number> {
    ctx.authz.requireRecentAuthentication();
    const { uow, clock } = this.deps;
    return uow.run({ organizationId: ctx.organizationId, userId: ctx.userId }, async (r) => {
      const revoked = await r.sessions.revokeAllForUser(ctx.userId!, clock.now(), 'logout_all');
      await recordAudit(r, this.deps, ctx, {
        organizationId: ctx.organizationId,
        action: 'auth.logout_all',
        target: { type: 'user', id: ctx.userId! },
        outcome: 'success',
        metadata: { sessions: revoked },
      });
      return revoked;
    });
  }

  // ------------------------------------------------------------ contexto y sesiones
  /** PF-009: cambia de organización; reemite la sesión con el tenant nuevo. */
  async switchOrganization(
    ctx: RequestContext,
    cookieValue: string | undefined,
    organizationId: Uuid,
  ): Promise<IssuedSession> {
    const parsed = parseCookie(cookieValue);
    if (!parsed || !ctx.userId) throw unauthenticated();
    const { uow, clock, tokens } = this.deps;

    const allowed = await uow.run({ userId: ctx.userId }, async (r) =>
      (await r.memberships.listActiveForUser(ctx.userId!)).some(
        (m) => m.organization.id === organizationId,
      ),
    );
    if (!allowed) throw notFound('La organización');

    const session = await uow.run({}, (r) => r.sessions.findById(parsed.id));
    if (!session) throw unauthenticated();
    const secret = tokens.generate();
    await uow.run({ organizationId, userId: ctx.userId }, async (r) => {
      await r.sessions.setOrganization(
        session.id,
        organizationId,
        sha256Hex(secret),
        session.secretHash,
      );
      await recordAudit(r, this.deps, ctx, {
        organizationId,
        action: 'auth.switch_organization',
        target: { type: 'session', id: session.id },
        outcome: 'success',
      });
    });
    return this.issued(session.id, secret, session.absoluteExpiresAt, clock.now());
  }

  async listSessions(ctx: RequestContext): Promise<SessionRecord[]> {
    return this.deps.uow.run({}, (r) =>
      r.sessions.listActiveForUser(ctx.userId!, this.deps.clock.now()),
    );
  }

  async revokeSession(ctx: RequestContext, sessionId: Uuid): Promise<void> {
    const { uow, clock } = this.deps;
    await uow.run({ organizationId: ctx.organizationId, userId: ctx.userId }, async (r) => {
      const target = await r.sessions.findById(sessionId);
      if (!target) throw notFound('La sesión');
      if (target.userId !== ctx.userId) {
        // Revocar la sesión de otra persona exige administrar su organización y que sea miembro.
        ctx.authz.require('organizations:admin');
        const member = ctx.organizationId
          ? await r.memberships.findCurrentForUser(ctx.organizationId, target.userId)
          : null;
        if (!member) throw notFound('La sesión');
      }
      await r.sessions.revoke(sessionId, clock.now(), 'revoked_by_user');
      await recordAudit(r, this.deps, ctx, {
        organizationId: ctx.organizationId,
        action: 'session.revoked',
        target: { type: 'session', id: sessionId },
        outcome: 'success',
      });
    });
  }

  // ------------------------------------------------------------ internos
  private assertUsable(session: SessionRecord, now: Date): void {
    if (session.revokedAt) throw new AppError('session_revoked', 401, 'La sesión fue cerrada.');
    if (
      session.idleExpiresAt.getTime() <= now.getTime() ||
      session.absoluteExpiresAt.getTime() <= now.getTime()
    ) {
      throw unauthenticated('La sesión venció.');
    }
  }

  private async revokeAsReuse(session: SessionRecord, requestId: string, now: Date): Promise<void> {
    await this.deps.uow.run({}, async (r) => {
      await r.sessions.revoke(session.id, now, 'refresh_reuse_detected');
      await recordAudit(
        r,
        this.deps,
        { actor: { type: 'system', id: 'system:bff' }, requestId },
        {
          organizationId: null,
          action: 'auth.refresh_reuse_detected',
          target: { type: 'session', id: session.id },
          outcome: 'denied',
        },
      );
    });
  }

  private async upsertUser(
    r: Repositories,
    claims: {
      issuer: string;
      subject: string;
      email: string | null;
      emailVerified: boolean;
      name: string | null;
    },
  ) {
    const { pii, ids, clock } = this.deps;
    // Solo se confía en un correo que el proveedor marca como verificado.
    const email = claims.emailVerified && claims.email ? assertEmail(claims.email) : null;
    const existing = await r.users.findByIdentity(claims.issuer, claims.subject);
    const now = clock.now();

    if (existing) {
      const profile = {
        displayName: claims.name ?? existing.displayName,
        emailCiphertext: email ? pii.encrypt(email) : existing.emailCiphertext,
        emailBlindIndex: email ? pii.blindIndex(email) : existing.emailBlindIndex,
      };
      await r.users.updateProfile(existing.id, profile, now);
      return { ...existing, ...profile };
    }
    const user = {
      id: ids.next(),
      displayName: claims.name,
      emailCiphertext: email ? pii.encrypt(email) : null,
      emailBlindIndex: email ? pii.blindIndex(email) : null,
    };
    await r.users.insert({ ...user, issuer: claims.issuer, subject: claims.subject }, now);
    return user;
  }

  private newSession(
    userId: Uuid,
    organizationId: Uuid | null,
    amr: string[],
    authTime: Date,
    now: Date,
    meta: { deviceLabel?: string | null; ipPseudonym?: string | null },
  ): { record: SessionRecord; session: IssuedSession } {
    const { ids, tokens, policy } = this.deps;
    const id = ids.next();
    const secret = tokens.generate();
    const absoluteExpiresAt = new Date(now.getTime() + policy.absoluteTtlMs);
    const record: SessionRecord = {
      id,
      userId,
      organizationId,
      secretHash: sha256Hex(secret),
      previousSecretHash: null,
      deviceLabel: meta.deviceLabel ?? null,
      ipPseudonym: meta.ipPseudonym ?? null,
      authTime,
      amr: amr.length ? amr : ['pwd'],
      createdAt: now,
      lastUsedAt: now,
      idleExpiresAt: new Date(now.getTime() + policy.idleTtlMs),
      absoluteExpiresAt,
      revokedAt: null,
    };
    return { record, session: this.issued(id, secret, absoluteExpiresAt, now) };
  }

  private issued(
    sessionId: Uuid,
    secret: string,
    absoluteExpiresAt: Date,
    now: Date,
  ): IssuedSession {
    return {
      sessionId,
      cookieValue: `${sessionId}${COOKIE_SEPARATOR}${secret}`,
      csrfToken: this.csrfTokenFor(sessionId),
      maxAgeSeconds: Math.max(0, Math.floor((absoluteExpiresAt.getTime() - now.getTime()) / 1000)),
    };
  }
}
