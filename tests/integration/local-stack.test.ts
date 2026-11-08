// La cadena de local completa, por red: navegador → gateway (sesión de prueba) → platform-api / CMS, que verifican el
// token interno contra el JWKS del gateway (MOCK-05). Más la Public Read API, anónima.
import { createServer, type AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCmsApi, buildPublicApi } from '../../services/content-api/src/app.ts';
import { buildGateway } from '../../services/gateway/src/app.ts';
import { buildPlatformApi } from '../../services/platform-api/src/app.ts';

type FastifyInstance = Awaited<ReturnType<typeof buildGateway>>;

const ISSUER = 'http://localhost:8080';
const ORG_ID = '01933f40-1a2b-7c3d-8e4f-5a6b7c8d9e0f';

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

const apps: FastifyInstance[] = [];
let gateway: FastifyInstance;
let platformUrl: string;
let publicApi: FastifyInstance;

beforeAll(async () => {
  const gatewayPort = await freePort();
  const jwksUrl = new URL(`http://127.0.0.1:${gatewayPort}/.well-known/jwks.json`);
  const base = { appEnv: 'local' as const, logLevel: 'info', dataSource: 'memory' as const, issuer: ISSUER, jwksUrl };

  const platform = await buildPlatformApi({ config: { ...base, port: 0 }, logger: false });
  platformUrl = await platform.listen({ port: 0, host: '127.0.0.1' });
  const cms = await buildCmsApi({ config: { ...base, port: 0 }, logger: false });
  const cmsUrl = await cms.listen({ port: 0, host: '127.0.0.1' });
  publicApi = await buildPublicApi({ config: { ...base, port: 0 }, logger: false });

  gateway = await buildGateway({
    logger: false,
    config: {
      appEnv: 'local',
      logLevel: 'info',
      port: gatewayPort,
      issuer: ISSUER,
      platformUrl: new URL(platformUrl),
      cmsUrl: new URL(cmsUrl),
      mockRole: 'site_editor',
    },
  });
  await gateway.listen({ port: gatewayPort, host: '127.0.0.1' });
  apps.push(gateway, platform, cms, publicApi);
});

afterAll(async () => {
  await Promise.all(apps.map((app) => app.close()));
});

describe('cadena local con mocks', () => {
  it('GET /platform/v1/me por el gateway llega con token válido y responde el mock', async () => {
    const res = await gateway.inject({ url: '/platform/v1/me' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-mock']).toBe('example');
  });

  it('directo a platform-api sin token es 401', async () => {
    const res = await fetch(`${platformUrl}/platform/v1/me`);
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
  });

  it('el rol de la sesión manda: site_editor no administra la organización (403)', async () => {
    const res = await gateway.inject({
      method: 'PATCH',
      url: `/platform/v1/organizations/${ORG_ID}`,
      headers: { 'content-type': 'application/merge-patch+json', 'if-match': '"r1"' },
      payload: '{"display_name":"Otro nombre"}',
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'forbidden' });
  });

  it('crear un sitio en el CMS: mock 201 e idempotencia', async () => {
    const request = {
      method: 'POST' as const,
      url: '/cms/v1/sites',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'clave-integracion-0001' },
      payload: { slug: 'congreso-demo', name: 'Congreso Demo', kind: 'demo', locale: 'es-PE' },
    };
    const first = await gateway.inject(request);
    expect(first.statusCode).toBe(201);
    expect(first.headers['x-mock']).toBe('example');
    const again = await gateway.inject(request);
    expect(again.json()).toEqual(first.json());
    const reused = await gateway.inject({ ...request, payload: { ...request.payload, name: 'Otro' } });
    expect(reused.statusCode).toBe(409);
  });

  it('la Public Read API responde la página con su path codificado', async () => {
    const res = await publicApi.inject({ url: '/public/v1/sites/congreso-demo/pages/%2Fguia' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-mock']).toBe('example');
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
