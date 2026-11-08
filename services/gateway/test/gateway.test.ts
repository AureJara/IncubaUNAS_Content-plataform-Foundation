import { createTokenVerifier } from '@incuba/authz';
import { ConfigError } from '@incuba/http-kit';
import Fastify, { type FastifyInstance } from 'fastify';
import { createLocalJWKSet, type JSONWebKeySet } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildGateway } from '../src/app.ts';
import type { GatewayConfig } from '../src/config.ts';
import { TEST_SESSION } from '../src/infrastructure/test-session.ts';

const ISSUER = 'http://localhost:8080';

interface Echo {
  url: string;
  method: string;
  authorization?: string;
  cookie?: string;
  requestId?: string;
  body: string;
}

let upstream: FastifyInstance;
let gateway: FastifyInstance;
let config: GatewayConfig;

beforeAll(async () => {
  // Servicio falso: devuelve lo que recibió.
  upstream = Fastify();
  upstream.removeAllContentTypeParsers();
  upstream.addContentTypeParser('*', { parseAs: 'string' }, (_req, body, done) => done(null, body));
  upstream.all('/*', async (request): Promise<Echo> => {
    const echo: Echo = { url: request.url, method: request.method, body: String(request.body ?? '') };
    if (request.headers.authorization) echo.authorization = request.headers.authorization;
    if (request.headers.cookie) echo.cookie = request.headers.cookie;
    if (typeof request.headers['x-request-id'] === 'string') echo.requestId = request.headers['x-request-id'];
    return echo;
  });
  const address = await upstream.listen({ port: 0, host: '127.0.0.1' });
  config = {
    appEnv: 'local',
    logLevel: 'info',
    port: 0,
    issuer: ISSUER,
    platformUrl: new URL(address),
    cmsUrl: new URL(address),
    mockRole: 'site_editor',
  };
  gateway = await buildGateway({ config, logger: false });
  await gateway.ready();
});

afterAll(async () => {
  await gateway.close();
  await upstream.close();
});

async function verifierFor(audience: 'platform-api' | 'content-api') {
  const jwks = (await gateway.inject({ url: '/.well-known/jwks.json' })).json() as JSONWebKeySet;
  return createTokenVerifier({ issuer: ISSUER, audience, keys: createLocalJWKSet(jwks) });
}

describe('proxy con token interno (spec 3.6, MOCK-05)', () => {
  it('reenvía a platform-api con un token para su audiencia, sin la cookie y con el mismo request ID', async () => {
    const res = await gateway.inject({ url: '/platform/v1/me?x=1', headers: { cookie: 'sid=secreto' } });
    expect(res.statusCode).toBe(200);
    const echo = res.json() as Echo;
    expect(echo.url).toBe('/platform/v1/me?x=1');
    expect(echo.cookie).toBeUndefined();
    expect(echo.requestId).toBe(res.headers['x-request-id']);
    const claims = await (await verifierFor('platform-api'))(echo.authorization?.replace('Bearer ', '') ?? '');
    expect(claims).toMatchObject({
      sub: TEST_SESSION.userId,
      organization_id: TEST_SESSION.organizationId,
      roles: ['site_editor'],
      scopes: ['sites:write', 'sites:publish'],
      amr: ['pwd', 'mfa'],
    });
  });

  it('el cuerpo pasa intacto y el CMS recibe la audiencia content-api', async () => {
    const payload = '{"slug":"congreso-demo","name":"Congreso"}';
    const res = await gateway.inject({
      method: 'POST',
      url: '/cms/v1/sites',
      headers: { 'content-type': 'application/json' },
      payload,
    });
    const echo = res.json() as Echo;
    expect(echo.body).toBe(payload);
    await expect(
      (await verifierFor('content-api'))(echo.authorization?.replace('Bearer ', '') ?? ''),
    ).resolves.toMatchObject({ aud: 'content-api' });
  });

  it('las solicitudes de demo van sin token', async () => {
    const res = await gateway.inject({
      method: 'POST',
      url: '/public/v1/sites/congreso-demo/leads',
      headers: { 'content-type': 'application/json', authorization: 'Bearer del-navegador' },
      payload: '{}',
    });
    expect((res.json() as Echo).authorization).toBeUndefined();
  });
});

describe('operaciones propias del gateway', () => {
  it('ready informa el estado de cada operación (MOCK-04)', async () => {
    const res = await gateway.inject({ url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json().operations).toMatchObject({ getJwks: 'memory', startLogin: 'example', getHealthLive: 'real' });
  });

  it('el login responde su mock mientras el BFF no exista', async () => {
    const res = await gateway.inject({ url: '/auth/login?return_to=/panel' });
    expect(res.statusCode).toBe(302);
    expect(res.headers['x-mock']).toBe('example');
  });
});

describe('fallas y entornos', () => {
  it('un servicio caído es 503 en Problem Details', async () => {
    const down = await buildGateway({
      config: { ...config, platformUrl: new URL('http://127.0.0.1:9') },
      logger: false,
    });
    const res = await down.inject({ url: '/platform/v1/me' });
    expect(res.statusCode).toBe(503);
    expect(res.headers['retry-after']).toBe('5');
    expect(res.json()).toMatchObject({ code: 'service_unavailable' });
    await down.close();
  });

  it('en staging no arranca con la sesión de prueba (MOCK-06)', async () => {
    await expect(buildGateway({ config: { ...config, appEnv: 'staging' }, logger: false })).rejects.toBeInstanceOf(
      ConfigError,
    );
  });
});
