import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Authorization } from '@incubaunas/tenancy';
import {
  ContractBindingError,
  bindOperations,
  createConformanceChecker,
  createServer,
  loadOperations,
  sendPublicCacheable,
  type ApiOperation,
  type Authenticator,
  type OperationHandler,
} from '../src/index.js';

const ORG = '0192f3a0-0000-7000-8000-0000000000a1';
const spec = (name: string) =>
  new URL(`../../../contracts/openapi/${name}`, import.meta.url).pathname.replace(
    /^\/([A-Za-z]:)/,
    '$1',
  );

const cookieAuthenticator: Authenticator = {
  async authenticate(request) {
    if (request.cookies['__Host-session'] !== 'ok') return null;
    return {
      context: {
        requestId: request.id,
        organizationId: ORG,
        actor: { type: 'user', id: 'u-1' },
        authz: new Authorization({
          roles: ['org_owner'],
          authTime: new Date(),
          amr: ['pwd', 'mfa'],
        }),
      },
      verifyCsrf: (token) => token === 'csrf-ok',
    };
  },
};

const stubs = (operations: readonly ApiOperation[]): Record<string, OperationHandler> =>
  Object.fromEntries(
    operations.map((o) => [o.operationId, async () => ({ operation: o.operationId })]),
  );

describe('enlace OpenAPI ↔ Fastify', () => {
  let operations: ApiOperation[];
  let app: FastifyInstance;

  beforeAll(async () => {
    operations = await loadOperations(spec('platform.v1.yaml'));
    app = await createServer({
      serviceName: 'test',
      authenticators: { sessionCookie: cookieAuthenticator },
      corsOrigins: ['http://localhost:3000'],
      logLevel: 'silent',
    });
    bindOperations(app, operations, stubs(operations));
    await app.ready();
  });

  afterAll(() => app.close());

  it('cada operación del contrato queda registrada', () => {
    expect(operations.length).toBeGreaterThanOrEqual(26);
    expect(operations.find((o) => o.operationId === 'getOrganization')?.url).toBe(
      '/platform/v1/organizations/:organization_id',
    );
  });

  it('el servicio no arranca si falta un handler o sobra uno', async () => {
    const other = await createServer({
      serviceName: 't',
      authenticators: {},
      corsOrigins: [],
      logLevel: 'silent',
    });
    const { createOrganization: _omitted, ...incomplete } = stubs(operations);
    expect(() => bindOperations(other, operations, incomplete)).toThrow(ContractBindingError);
    expect(() =>
      bindOperations(other, operations, { ...stubs(operations), inventada: async () => ({}) }),
    ).toThrow(/no declara: inventada/);
    await other.close();
  });

  it('una operación pública responde sin credenciales y valida sus parámetros', async () => {
    const ok = await app.inject({ method: 'GET', url: '/public/v1/hosts/eventos.example.test' });
    expect(ok.statusCode).toBe(200);

    const tooLong = await app.inject({
      method: 'GET',
      url: `/public/v1/hosts/${'a'.repeat(300)}.test`,
    });
    expect(tooLong.statusCode).toBe(400);
    expect(tooLong.headers['content-type']).toContain('application/problem+json');
  });

  it('una operación protegida sin credenciales devuelve 401 con el mismo request_id del header', async () => {
    const response = await app.inject({ method: 'GET', url: '/platform/v1/me' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'unauthenticated', status: 401 });
    expect(response.json().request_id).toBe(response.headers['x-request-id']);
  });

  it('exige CSRF en mutaciones con cookie y luego Idempotency-Key', async () => {
    const base = {
      method: 'POST' as const,
      url: '/platform/v1/session-context',
      cookies: { '__Host-session': 'ok' },
      payload: { organization_id: ORG },
    };

    const noCsrf = await app.inject(base);
    expect(noCsrf.statusCode).toBe(403);
    expect(noCsrf.json().code).toBe('csrf_invalid');

    const noKey = await app.inject({ ...base, headers: { 'x-csrf-token': 'csrf-ok' } });
    expect(noKey.statusCode).toBe(400);
    expect(noKey.json().code).toBe('idempotency_key_required');

    const ok = await app.inject({
      ...base,
      headers: { 'x-csrf-token': 'csrf-ok', 'idempotency-key': 'a'.repeat(20) },
    });
    expect(ok.statusCode).toBe(200);
  });

  it('rechaza campos desconocidos en el cuerpo en lugar de ignorarlos', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/platform/v1/session-context',
      cookies: { '__Host-session': 'ok' },
      headers: { 'x-csrf-token': 'csrf-ok', 'idempotency-key': 'b'.repeat(20) },
      payload: { organization_id: ORG, tenant_id: 'otra' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().errors[0]).toMatchObject({
      pointer: '/tenant_id',
      code: 'additionalProperties',
    });
  });

  it('acepta un X-Request-Id válido y reemplaza uno malicioso', async () => {
    const good = await app.inject({
      method: 'GET',
      url: '/public/v1/hosts/a.test',
      headers: { 'x-request-id': 'req-12345678' },
    });
    expect(good.headers['x-request-id']).toBe('req-12345678');

    const bad = await app.inject({
      method: 'GET',
      url: '/public/v1/hosts/a.test',
      headers: { 'x-request-id': 'x\ninjected: 1' },
    });
    expect(bad.headers['x-request-id']).not.toContain('injected');
  });

  it('una ruta inexistente devuelve Problem Details 404', async () => {
    const response = await app.inject({ method: 'GET', url: '/no/existe' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });
});

describe('cache pública', () => {
  it('emite ETag y Surrogate-Key y responde 304 cuando no cambió', async () => {
    const app = await createServer({
      serviceName: 't',
      authenticators: {},
      corsOrigins: [],
      logLevel: 'silent',
    });
    app.get('/x', { config: { security: [] } }, async (request, reply) =>
      sendPublicCacheable(
        request,
        reply,
        { a: 1 },
        { maxAge: 30, sMaxAge: 300, surrogateKeys: ['site:1', 'page:2'] },
      ),
    );

    const first = await app.inject({ method: 'GET', url: '/x' });
    expect(first.headers['surrogate-key']).toBe('site:1 page:2');
    expect(first.headers['cache-control']).toContain('s-maxage=300');

    const second = await app.inject({
      method: 'GET',
      url: '/x',
      headers: { 'if-none-match': String(first.headers.etag) },
    });
    expect(second.statusCode).toBe(304);
    await app.close();
  });
});

describe('verificador de conformidad', () => {
  it('acepta una respuesta válida y detecta una que viola el contrato', async () => {
    const operations = await loadOperations(spec('platform.v1.yaml'));
    const check = createConformanceChecker(operations);
    const host = { hostname: 'a.test', site_id: ORG, organization_id: ORG };

    expect(() => check('resolveHost', 200, 'application/json', host)).not.toThrow();
    expect(() => check('resolveHost', 200, 'application/json', { hostname: 'a.test' })).toThrow(
      /no cumple el contrato/,
    );
    expect(() => check('resolveHost', 418, 'application/json', host)).toThrow(/no está declarado/);
  });
});

describe('redacción de secretos en la URL de los logs', () => {
  it('oculta el token de invitación, el de vista previa y el code del callback OIDC', async () => {
    const { redactUrl } = await import('../src/index.js');
    expect(redactUrl('/public/v1/invitations/abc123.secreto/acceptance')).toBe(
      '/public/v1/invitations/[redacted]/acceptance',
    );
    expect(redactUrl('/public/v1/previews/org.secreto')).toBe('/public/v1/previews/[redacted]');
    expect(redactUrl('/auth/callback?code=XYZ&state=ABC&iss=http%3A%2F%2Fidp')).toBe(
      '/auth/callback?code=[redacted]&state=[redacted]&iss=http%3A%2F%2Fidp',
    );
    expect(redactUrl('/platform/v1/me?limit=10')).toBe('/platform/v1/me?limit=10');
  });
});
