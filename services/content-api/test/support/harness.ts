import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SignJWT } from 'jose';
import { createConformanceChecker, type ApiOperation } from '@incubaunas/http-kit';
import { createPool, migrate, type Pool } from '@incubaunas/db';
import { EventContractValidator, InMemoryEventBus } from '@incubaunas/events';
import { randomToken, uuidV7Generator, type Clock } from '@incubaunas/shared-kernel';
import { JoseTokenVerifier, type Role, type Scope } from '@incubaunas/tenancy';
import { buildContentApp } from '../../src/app.js';
import {
  FakeMalwareScanner,
  InMemoryManifestFetcher,
  InMemoryObjectStorage,
} from '../../src/infrastructure/adapters.js';
import { PgPublicReader } from '../../src/infrastructure/pg/public-read.js';
import { PgUnitOfWork } from '../../src/infrastructure/pg/unit-of-work.js';

export const adminUrl = process.env.CONTENT_DATABASE_ADMIN_URL;
export const appUrl = process.env.CONTENT_DATABASE_URL;
export const dbConfigured = Boolean(adminUrl && appUrl);
if (!dbConfigured && process.env.CI) throw new Error('CI exige las URLs de la base de Content');

const JWT_SECRET = 'test-jwt-secret-with-at-least-32-bytes!!';
const ISSUER = 'https://platform.test';
const AUDIENCE = 'content-api';

export class OffsetClock implements Clock {
  private offsetMs = 0;
  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }
  advanceSeconds(seconds: number): void {
    this.offsetMs += seconds * 1000;
  }
}

export interface Response {
  status: number;
  body: any;
  headers: Record<string, string | string[] | number | undefined>;
}

export interface CallOptions {
  params?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  bearer?: string;
  skipConformance?: boolean;
}

export async function createHarness() {
  await migrate({
    connectionString: adminUrl!,
    directory: fileURLToPath(new URL('../../migrations', import.meta.url)),
  });

  const pool: Pool = createPool({ connectionString: appUrl!, max: 8 });
  const clock = new OffsetClock();
  const storage = new InMemoryObjectStorage();
  const scanner = new FakeMalwareScanner();
  const fetcher = new InMemoryManifestFetcher();
  const bus = new InMemoryEventBus();
  const secret = new TextEncoder().encode(JWT_SECRET);

  const built = await buildContentApp({
    uow: new PgUnitOfWork(pool, new EventContractValidator(), clock),
    reader: new PgPublicReader(pool),
    clock,
    ids: uuidV7Generator,
    tokens: { generate: () => randomToken(32) },
    storage,
    scanner,
    fetcher,
    tokenVerifier: new JoseTokenVerifier({
      key: secret,
      issuer: ISSUER,
      algorithms: ['HS256'],
      clock,
    }),
    tokenAudience: AUDIENCE,
    previewBaseUrl: 'http://localhost:4321',
    corsOrigins: ['http://localhost:3000'],
    logLevel: process.env.TEST_LOG ? 'error' : 'silent',
    rateLimitPerMinute: 1_000_000,
  });
  built.projections.register(bus);

  const { app, operations } = built;
  const conforms = createConformanceChecker(operations);
  const byId = new Map<string, ApiOperation>(operations.map((o) => [o.operationId, o]));

  async function bearer(options: {
    organizationId: string;
    roles?: Role[];
    scopes?: Scope[];
    sub?: string;
  }) {
    const now = Math.floor(clock.now().getTime() / 1000);
    return new SignJWT({
      roles: options.roles ?? ['site_editor'],
      scopes: options.scopes ?? [],
      amr: ['pwd', 'mfa'],
      organization_id: options.organizationId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(options.sub ?? 'service:gateway')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + 7 * 24 * 3600)
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
    if (operation.bodyMediaTypes[0] && options.body !== undefined)
      headers['content-type'] ??= operation.bodyMediaTypes[0];
    if (
      operation.schema.headers &&
      JSON.stringify(operation.schema.headers).includes('idempotency-key')
    ) {
      headers['idempotency-key'] ??= randomUUID();
    }
    if (options.bearer) headers.authorization = `Bearer ${options.bearer}`;

    const response = await app.inject({
      method: operation.method,
      url: search ? `${path}?${search}` : path,
      headers,
      payload: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const contentType = String(response.headers['content-type'] ?? '');
    const body = contentType.includes('json') ? response.json() : undefined;
    if (!options.skipConformance) conforms(operationId, response.statusCode, contentType, body);
    return { status: response.statusCode, body, headers: response.headers };
  }

  return {
    app,
    pool,
    clock,
    storage,
    scanner,
    fetcher,
    bus,
    call,
    bearer,
    media: built.media,
    async close() {
      await app.close();
      await pool.end();
    },
  };
}

export type Harness = Awaited<ReturnType<typeof createHarness>>;
export const unique = () => randomUUID().replace(/-/g, '').slice(0, 10);
