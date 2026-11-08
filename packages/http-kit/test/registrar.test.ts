import { systemClock } from '@incuba/shared-kernel';
import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  createBearerSecurity,
  createHttpApp,
  loadContract,
  MemoryIdempotencyStore,
  registerContract,
  type Handlers,
  type Principal,
  type RegisterContractOptions,
} from '../src/index.ts';
import { ITEM_ID, testDocument } from './fixtures.ts';

const PRINCIPALS: Record<string, Principal> = {
  reader: { subject: 'u-reader', organizationId: 'org-1', roles: [], scopes: ['items:read'], amr: [] },
  writer: { subject: 'u-writer', organizationId: 'org-1', roles: [], scopes: ['items:read', 'items:write'], amr: [] },
};

const security = createBearerSecurity({
  verify: async (token) => {
    const principal = PRINCIPALS[token];
    if (principal === undefined) throw new Error('token desconocido');
    return principal;
  },
  decide: (principal, op) =>
    op.requiredScope !== undefined && !principal.scopes.includes(op.requiredScope) ? 'forbidden' : 'ok',
});

async function build(options: Partial<RegisterContractOptions> = {}) {
  const app = createHttpApp({ serviceName: 'prueba', logger: false });
  const states = registerContract(app, {
    contract: loadContract(testDocument),
    handlers: {},
    appEnv: 'local',
    security,
    idempotency: new MemoryIdempotencyStore(systemClock),
    ...options,
  });
  await app.ready();
  return { app, states };
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

describe('mock de contrato (MOCK-01, MOCK-04)', () => {
  it('responde el ejemplo por defecto y lo marca con X-Mock', async () => {
    const { app, states } = await build();
    const res = await app.inject({ url: `/items/${ITEM_ID}`, headers: auth('reader') });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-mock']).toBe('example');
    expect(res.json()).toEqual({ id: ITEM_ID, name: 'Uno', revision: 1 });
    expect(states).toMatchObject({ getItem: 'example', createItem: 'example' });
  });

  it('`Prefer: example=<nombre>` elige otro ejemplo', async () => {
    const { app } = await build();
    const res = await app.inject({
      url: `/items/${ITEM_ID}`,
      headers: { ...auth('reader'), prefer: 'example=renamed' },
    });
    expect(res.json()).toMatchObject({ name: 'Otro' });
    expect(res.headers['preference-applied']).toBe('example=renamed');
  });

  it('un ejemplo de error sale como Problem Details con el request ID real', async () => {
    const { app } = await build();
    const res = await app.inject({
      url: `/items/${ITEM_ID}`,
      headers: { ...auth('reader'), prefer: 'example=not_found' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ code: 'not_found', request_id: res.headers['x-request-id'] });
  });

  it('calcula el ETag del ejemplo a partir de su revisión', async () => {
    const { app } = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/items',
      headers: { ...auth('writer'), 'idempotency-key': 'clave-de-prueba-0001' },
      payload: { name: 'Uno' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.headers['etag']).toBe('"r1"');
  });
});

describe('validación del request', () => {
  it('401 sin token y 403 sin el scope', async () => {
    const { app } = await build();
    const anonymous = await app.inject({ url: `/items/${ITEM_ID}` });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.headers['www-authenticate']).toBe('Bearer');
    const reader = await app.inject({
      method: 'POST',
      url: '/items',
      headers: { ...auth('reader'), 'idempotency-key': 'clave-de-prueba-0001' },
      payload: { name: 'Uno' },
    });
    expect(reader.statusCode).toBe(403);
    expect(reader.json()).toMatchObject({ code: 'forbidden' });
  });

  it('400 con pointer para parámetros inválidos o desconocidos', async () => {
    const { app } = await build();
    const badId = await app.inject({ url: '/items/no-es-uuid', headers: auth('reader') });
    expect(badId.statusCode).toBe(400);
    expect(badId.json().errors).toEqual([expect.objectContaining({ pointer: '/path/id' })]);
    const badQuery = await app.inject({ url: `/items/${ITEM_ID}?fields=99&extra=1`, headers: auth('reader') });
    expect(
      badQuery
        .json()
        .errors.map((e: { pointer: string }) => e.pointer)
        .sort(),
    ).toEqual(['/query/extra', '/query/fields']);
  });

  it('RN-05: un organization_id en la query o en un header es 422', async () => {
    const { app } = await build();
    const res = await app.inject({
      url: `/items/${ITEM_ID}?organization_id=${ITEM_ID}`,
      headers: { ...auth('reader'), 'x-organization-id': ITEM_ID },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().errors.map((e: { pointer: string }) => e.pointer)).toEqual([
      '/query/organization_id',
      '/headers/x-organization-id',
    ]);
  });

  it('422 con pointer para un cuerpo inválido o ausente; 415 para otro tipo', async () => {
    const { app } = await build();
    const headers = { ...auth('writer'), 'idempotency-key': 'clave-de-prueba-0002' };
    const invalid = await app.inject({ method: 'POST', url: '/items', headers, payload: { name: '', extra: 1 } });
    expect(invalid.statusCode).toBe(422);
    expect(
      invalid
        .json()
        .errors.map((e: { pointer: string }) => e.pointer)
        .sort(),
    ).toEqual(['/extra', '/name']);
    const missing = await app.inject({ method: 'POST', url: '/items', headers });
    expect(missing.statusCode).toBe(422);
    const text = await app.inject({
      method: 'POST',
      url: '/items',
      headers: { ...headers, 'content-type': 'text/plain' },
      payload: 'hola',
    });
    expect(text.statusCode).toBe(415);
  });

  it('428 sin If-Match; con If-Match acepta JSON Merge Patch', async () => {
    const { app } = await build();
    const patch = { method: 'PATCH' as const, url: `/items/${ITEM_ID}`, payload: '{"name":"Otro"}' };
    const headers = { ...auth('writer'), 'content-type': 'application/merge-patch+json' };
    expect((await app.inject({ ...patch, headers })).statusCode).toBe(428);
    const ok = await app.inject({ ...patch, headers: { ...headers, 'if-match': '"r1"' } });
    expect(ok.statusCode).toBe(200);
  });
});

describe('idempotencia (RN-22)', () => {
  it('misma clave y mismo cuerpo repiten; otro cuerpo es 409', async () => {
    let calls = 0;
    const handlers: Handlers = {
      createItem: {
        state: 'memory',
        handle: async () => {
          calls += 1;
          return { status: 201, body: { id: ITEM_ID, name: 'Uno', revision: calls } };
        },
      },
    };
    const { app } = await build({ handlers });
    const request = {
      method: 'POST' as const,
      url: '/items',
      headers: { ...auth('writer'), 'idempotency-key': 'clave-de-prueba-0003' },
    };
    const first = await app.inject({ ...request, payload: { name: 'Uno' } });
    const second = await app.inject({ ...request, payload: { name: 'Uno' } });
    expect(second.json()).toEqual(first.json());
    expect(calls).toBe(1);
    const other = await app.inject({ ...request, payload: { name: 'Dos' } });
    expect(other.statusCode).toBe(409);
    expect(other.json()).toMatchObject({ code: 'idempotency_key_reused' });
  });
});

describe('handlers y respuestas', () => {
  it('decodifica %2F en un parámetro de ruta y marca X-Mock: memory', async () => {
    const handlers: Handlers = {
      getPage: { state: 'memory', handle: async ({ params }) => ({ status: 200, body: { path: params['path'] } }) },
    };
    const { app, states } = await build({ handlers });
    const res = await app.inject({ url: '/pages/%2Fguia' });
    expect(res.json()).toEqual({ path: '/guia' });
    expect(res.headers['x-mock']).toBe('memory');
    expect(states['getPage']).toBe('memory');
  });

  it('un handler real no lleva X-Mock', async () => {
    const handlers: Handlers = {
      getPage: { state: 'real', handle: async () => ({ status: 200, body: { path: '/' } }) },
    };
    const { app } = await build({ handlers });
    const res = await app.inject({ url: '/pages/%2F' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-mock']).toBeUndefined();
  });

  it('una respuesta fuera de contrato es 500, no se entrega', async () => {
    const handlers: Handlers = { getPage: { state: 'real', handle: async () => ({ status: 200, body: { otra: 1 } }) } };
    const { app } = await build({ handlers });
    const res = await app.inject({ url: '/pages/%2F' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ code: 'internal_error' });
  });
});

describe('request ID y rutas', () => {
  it('conserva un X-Request-Id válido y reemplaza uno inválido', async () => {
    const { app } = await build();
    const kept = await app.inject({ url: '/pages/%2F', headers: { 'x-request-id': 'abc-123-def-456' } });
    expect(kept.headers['x-request-id']).toBe('abc-123-def-456');
    const replaced = await app.inject({ url: '/pages/%2F', headers: { 'x-request-id': 'no válido' } });
    expect(replaced.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(replaced.headers['x-content-type-options']).toBe('nosniff');
  });

  it('una ruta desconocida es 404 en Problem Details', async () => {
    const { app } = await build();
    const res = await app.inject({ url: '/no-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'not_found', request_id: res.headers['x-request-id'] });
  });
});

describe('arranque (MOCK-06)', () => {
  it('en staging no arranca con operaciones sin caso de uso', () => {
    const app = createHttpApp({ serviceName: 'prueba', logger: false });
    expect(() =>
      registerContract(app, { contract: loadContract(testDocument), handlers: {}, appEnv: 'staging', security }),
    ).toThrow(ConfigError);
  });

  it('en producción no arranca con handlers en memoria', () => {
    const app = createHttpApp({ serviceName: 'prueba', logger: false });
    const real = { state: 'real' as const, handle: async () => ({ status: 200 }) };
    expect(() =>
      registerContract(app, {
        contract: loadContract(testDocument),
        handlers: { createItem: real, getItem: real, updateItem: real, getPage: { ...real, state: 'memory' } },
        appEnv: 'production',
        security,
      }),
    ).toThrow(/DATA_SOURCE=memory/);
  });

  it('rechaza handlers de operaciones que el contrato no tiene', () => {
    const app = createHttpApp({ serviceName: 'prueba', logger: false });
    const handlers: Handlers = { noExiste: { state: 'real', handle: async () => ({ status: 200 }) } };
    expect(() =>
      registerContract(app, { contract: loadContract(testDocument), handlers, appEnv: 'local', security }),
    ).toThrow(/noExiste/);
  });
});
