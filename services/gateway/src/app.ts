// Raíz de composición del gateway (spec 3.4 y 3.6).
import { createTokenSigner } from '@incuba/authz';
import {
  assertNoMocksOutsideLocal,
  createHttpApp,
  healthHandlers,
  mocksAllowed,
  readContract,
  registerContract,
  type OperationState,
} from '@incuba/http-kit';
import { createUuidV7, systemClock, type Clock } from '@incuba/shared-kernel';
import type { FastifyInstance } from 'fastify';
import type { SessionResolver } from './application/ports.ts';
import type { GatewayConfig } from './config.ts';
import { generateDevSigningKey, type SigningMaterial } from './infrastructure/dev-signing-key.ts';
import { testSessionResolver } from './infrastructure/test-session.ts';
import { jwksHandler } from './interfaces/http/jwks.ts';
import { registerProxy } from './interfaces/http/proxy.ts';
import { sessionSecurity } from './interfaces/http/session.ts';

export const CONTRACT = new URL('../../../contracts/dist/auth.json', import.meta.url);

export interface GatewayDeps {
  config: GatewayConfig;
  clock?: Clock;
  signingKey?: SigningMaterial;
  logger?: boolean;
}

export async function buildGateway(deps: GatewayDeps): Promise<FastifyInstance> {
  const { config } = deps;
  const clock = deps.clock ?? systemClock;

  // MOCK-05/06: la sesión de prueba existe solo en local y CI; fuera de ahí el gateway no arranca hasta el login real.
  const testSession = mocksAllowed(config.appEnv);
  assertNoMocksOutsideLocal(config.appEnv, { testSession });
  const resolveSession: SessionResolver = testSession
    ? testSessionResolver(config.mockRole, clock)
    : async () => undefined;

  const key = deps.signingKey ?? (await generateDevSigningKey());
  const sign = createTokenSigner({
    issuer: config.issuer,
    privateKey: key.privateKey,
    kid: key.kid,
    clock,
    newId: createUuidV7(clock),
  });

  const app = createHttpApp({
    serviceName: 'gateway',
    logLevel: config.logLevel,
    clock,
    ...(deps.logger === undefined ? {} : { logger: deps.logger }),
  });

  let states: Readonly<Record<string, OperationState>> = {};
  states = registerContract(app, {
    contract: await readContract(CONTRACT),
    appEnv: config.appEnv,
    security: sessionSecurity(resolveSession, clock),
    handlers: {
      ...healthHandlers({ appEnv: config.appEnv, checks: { signing_key: async () => 'ok' }, operations: () => states }),
      getJwks: jwksHandler([key.publicJwk]),
    },
  });

  await registerProxy(app, {
    resolveSession,
    sign,
    upstreams: [
      { route: '/platform/v1/*', target: config.platformUrl, audience: 'platform-api', session: 'required' },
      { route: '/cms/v1/*', target: config.cmsUrl, audience: 'content-api', session: 'required' },
      // Aceptar pide sesión; rechazar solo el token de la invitación (spec 9.3).
      { route: '/public/v1/invitations/*', target: config.platformUrl, audience: 'platform-api', session: 'optional' },
      { route: '/public/v1/sites/:slug/leads', target: config.platformUrl, session: 'none' },
    ],
  });

  return app;
}
