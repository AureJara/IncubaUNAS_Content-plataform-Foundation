import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SignJWT } from 'jose';
import { createConformanceChecker, type ApiOperation } from '@incubaunas/http-kit';
import { createPool, migrate, type Pool } from '@incubaunas/db';
import { EventContractValidator } from '@incubaunas/events';
import { randomToken, uuidV7Generator, type Clock } from '@incubaunas/shared-kernel';
import { JoseTokenVerifier, type Role, type Scope } from '@incubaunas/tenancy';
import { buildApp } from '../../src/app.js';
import { DEFAULT_SESSION_POLICY } from '../../src/application/sessions.js';
import type { IdentityClaims, OidcProvider } from '../../src/application/ports.js';
import { AesGcmPiiProtector, RandomTokenGenerator } from '../../src/infrastructure/crypto.js';
import { FakeDomainVerifier } from '../../src/infrastructure/domain-verifier.js';
import { InMemoryInvitationNotifier } from '../../src/infrastructure/notifier.js';
import { PgUnitOfWork } from '../../src/infrastructure/pg/unit-of-work.js';

export const adminUrl = process.env.PLATFORM_DATABASE_ADMIN_URL;
export const appUrl = process.env.PLATFORM_DATABASE_URL;
export const dbConfigured = Boolean(adminUrl && appUrl);
if (!dbConfigured && process.env.CI) throw new Error('CI exige las URLs de la base de Platform');

const JWT_SECRET = 'test-jwt-secret-with-at-least-32-bytes!!';
const ISSUER = 'https://platform.test';
const AUDIENCE = 'platform-api';
export const IDP = 'https://idp.test';
export const ADMIN_ORIGIN = 'http://localhost:3000';

/** Reloj con desplazamiento: permite "avanzar" el tiempo sin esperar. */
export class OffsetClock implements Clock {
  private offsetMs = 0;
  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }
  advanceSeconds(seconds: number): void {
    this.offsetMs += seconds * 1000;
  }
}

/** Proveedor OIDC de pruebas: el "code" selecciona la identidad que devuelve. */
export class FakeOidcProvider implements OidcProvider {
  readonly identities = new Map<string, IdentityClaims>();

  async createAuthorization() {
    const state = randomToken(12);
    return {
      url: `${IDP}/authorize?state=${state}`,
      state,
      nonce: randomToken(12),
      codeVerifier: randomToken(32),
    };
  }

  async completeAuthorization(params: {
    callbackUrl: URL;
    expectedState: string;
  }): Promise<IdentityClaims> {
    if (params.callbackUrl.searchParams.get('state') !== params.expectedState)
      throw new Error('state distinto');
    const claims = this.identities.get(params.callbackUrl.searchParams.get('code') ?? '');
    if (!claims) throw new Error('code desconocido');
    return claims;
  }
}

export interface Response {
  status: number;
  body: any;
  headers: Record<string, string | string[] | number | undefined>;
  cookies: Record<string, string>;
}

export interface Credentials {
  /** Cookies de una sesión iniciada por el flujo OIDC. */
  session?: { cookie: string; csrf: string };
  /** Token de máquina (Bearer). */
  bearer?: string;
}

export interface CallOptions {
  params?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  as?: Credentials;
  /** Cookies extra (p. ej. la del intento de login). */
  cookies?: Record<string, string>;
  /** No valida la respuesta contra el contrato (para casos deliberadamente fuera de él). */
  skipConformance?: boolean;
}

export async function createHarness() {
  await migrate({
    connectionString: adminUrl!,
    directory: fileURLToPath(new URL('../../migrations', import.meta.url)),
  });

  const pool: Pool = createPool({ connectionString: appUrl!, max: 8 });
  const clock = new OffsetClock();
  const idp = new FakeOidcProvider();
  const notifier = new InMemoryInvitationNotifier();
  const domainVerifier = new FakeDomainVerifier();
  const validator = new EventContractValidator();
  const secret = new TextEncoder().encode(JWT_SECRET);

  const built = await buildApp({
    uow: new PgUnitOfWork(pool, validator, clock),
    clock,
    ids: uuidV7Generator,
    tokens: new RandomTokenGenerator(),
    pii: new AesGcmPiiProtector(Buffer.alloc(32, 7)),
    notifier,
    oidc: idp,
    domainVerifier,
    tokenVerifier: new JoseTokenVerifier({
      key: secret,
      issuer: ISSUER,
      algorithms: ['HS256'],
      clock,
    }),
    tokenAudience: AUDIENCE,
    sessionPolicy: { ...DEFAULT_SESSION_POLICY, returnToOrigins: [ADMIN_ORIGIN] },
    oidcRedirectUri: 'http://localhost:4000/auth/callback',
    csrfSecret: 'test-csrf-secret-with-at-least-32-bytes!!',
    adminBaseUrl: ADMIN_ORIGIN,
    cookieNames: { session: '__Host-session', csrf: '__Host-csrf', loginAttempt: '__Host-oidc' },
    cookieSecure: true,
    corsOrigins: [ADMIN_ORIGIN],
    logLevel: process.env.TEST_LOG ? 'error' : 'silent',
    rateLimitPerMinute: 1_000_000,
  });

  const { app, operations } = built;
  const conforms = createConformanceChecker(operations);
  const byId = new Map<string, ApiOperation>(operations.map((o) => [o.operationId, o]));

  async function bearer(options: {
    scopes: Scope[];
    organizationId?: string;
    roles?: Role[];
    amr?: string[];
    sub?: string;
  }) {
    const now = Math.floor(clock.now().getTime() / 1000);
    return new SignJWT({
      scopes: options.scopes,
      roles: options.roles ?? [],
      amr: options.amr ?? ['pwd', 'mfa'],
      ...(options.organizationId ? { organization_id: options.organizationId } : {}),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(options.sub ?? 'service:test-admin')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + 7 * 24 * 3600) // largo: algunas pruebas adelantan el reloj horas
      .sign(secret);
  }

  async function call(operationId: string, options: CallOptions = {}): Promise<Response> {
    const operation = byId.get(operationId);
    if (!operation) throw new Error(`Operación desconocida: ${operationId}`);

    const path = operation.openApiPath.replace(/\{(\w+)\}/g, (_, key: string) =>
      encodeURIComponent(options.params?.[key] ?? ''),
    );
    const search = new URLSearchParams(
      Object.entries(options.query ?? {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();

    const headers: Record<string, string> = { ...options.headers };
    const cookies: Record<string, string> = { ...options.cookies };
    if (operation.bodyMediaTypes[0] && options.body !== undefined)
      headers['content-type'] ??= operation.bodyMediaTypes[0];
    const wantsKey = Boolean(
      operation.schema.headers &&
      JSON.stringify(operation.schema.headers).includes('idempotency-key'),
    );
    if (wantsKey) headers['idempotency-key'] ??= randomUUID();

    if (options.as?.bearer) headers.authorization = `Bearer ${options.as.bearer}`;
    if (options.as?.session) {
      cookies['__Host-session'] = options.as.session.cookie;
      if (operation.method !== 'GET') headers['x-csrf-token'] ??= options.as.session.csrf;
    }

    const response = await app.inject({
      method: operation.method,
      url: search ? `${path}?${search}` : path,
      headers,
      cookies,
      payload: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const contentType = String(response.headers['content-type'] ?? '');
    const body = contentType.includes('json') ? response.json() : undefined;
    if (!options.skipConformance) conforms(operationId, response.statusCode, contentType, body);

    return {
      status: response.statusCode,
      body,
      headers: response.headers,
      cookies: Object.fromEntries(response.cookies.map((c) => [c.name, c.value])),
    };
  }

  /** Inicia sesión por el flujo OIDC completo y devuelve las cookies de la sesión. */
  async function login(
    claims: Omit<IdentityClaims, 'issuer'> & { issuer?: string },
    returnTo = `${ADMIN_ORIGIN}/`,
  ) {
    const code = randomUUID();
    idp.identities.set(code, { issuer: IDP, ...claims });

    const started = await call('startLogin', { query: { return_to: returnTo } });
    if (started.status !== 302) throw new Error(`startLogin devolvió ${started.status}`);
    const state = new URL(String(started.headers.location)).searchParams.get('state')!;

    const completed = await call('completeLogin', {
      query: { code, state },
      cookies: { '__Host-oidc': started.cookies['__Host-oidc']! },
      skipConformance: true,
    });
    return {
      response: completed,
      session: {
        cookie: completed.cookies['__Host-session']!,
        csrf: completed.cookies['__Host-csrf']!,
      },
    };
  }

  return {
    app,
    pool,
    clock,
    idp,
    notifier,
    domainVerifier,
    operations,
    call,
    login,
    bearer,
    sessions: built.sessions,
    async close() {
      await app.close();
      await pool.end();
    },
  };
}

export type Harness = Awaited<ReturnType<typeof createHarness>>;

export const unique = () => randomUUID().replace(/-/g, '').slice(0, 10);
