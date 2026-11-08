// Raíces de composición de content-api (spec 3.4): el CMS (privado, detrás del gateway) y la Public Read API
// (anónima, cacheable). Son dos procesos del mismo servicio. En el Sprint 0 todas las operaciones responden con su
// mock de contrato (spec 3.8).
import { checkRequirement, createTokenVerifier, type TokenVerifier } from '@incuba/authz';
import {
  assertNoMocksOutsideLocal,
  createBearerSecurity,
  createHttpApp,
  healthHandlers,
  MemoryIdempotencyStore,
  principalFromClaims,
  readContract,
  registerContract,
  requirementOf,
  type OperationState,
} from '@incuba/http-kit';
import { systemClock, type Clock } from '@incuba/shared-kernel';
import type { FastifyInstance } from 'fastify';
import type { CmsConfig, PublicConfig } from './config.ts';

export const CMS_CONTRACT = new URL('../../../contracts/dist/cms.json', import.meta.url);
export const PUBLIC_CONTRACT = new URL('../../../contracts/dist/public.json', import.meta.url);

interface CommonDeps {
  clock?: Clock;
  logger?: boolean;
}

export interface CmsDeps extends CommonDeps {
  config: CmsConfig;
  /** Por defecto, contra el JWKS del gateway. */
  verifyToken?: TokenVerifier;
}

export interface PublicDeps extends CommonDeps {
  config: PublicConfig;
}

function baseApp(serviceName: string, logLevel: string, clock: Clock, logger: boolean | undefined) {
  return createHttpApp({ serviceName, logLevel, clock, ...(logger === undefined ? {} : { logger }) });
}

export async function buildCmsApi(deps: CmsDeps): Promise<FastifyInstance> {
  const { config } = deps;
  const clock = deps.clock ?? systemClock;
  assertNoMocksOutsideLocal(config.appEnv, { dataSource: config.dataSource });
  const verify =
    deps.verifyToken ??
    createTokenVerifier({ issuer: config.issuer, audience: 'content-api', keys: config.jwksUrl, clock });

  const app = baseApp('content-cms', config.logLevel, clock, deps.logger);
  let states: Readonly<Record<string, OperationState>> = {};
  states = registerContract(app, {
    contract: await readContract(CMS_CONTRACT),
    appEnv: config.appEnv,
    security: createBearerSecurity({
      verify: async (token) => principalFromClaims(await verify(token)),
      decide: (principal, operation) =>
        checkRequirement(principal, requirementOf(operation), Math.floor(clock.now().getTime() / 1000)),
    }),
    // F0-07 la cambia por la tabla de PostgreSQL.
    idempotency: new MemoryIdempotencyStore(clock),
    handlers: {
      ...healthHandlers({ appEnv: config.appEnv, checks: { contract: async () => 'ok' }, operations: () => states }),
    },
  });
  return app;
}

export async function buildPublicApi(deps: PublicDeps): Promise<FastifyInstance> {
  const { config } = deps;
  const clock = deps.clock ?? systemClock;
  assertNoMocksOutsideLocal(config.appEnv, { dataSource: config.dataSource });

  const app = baseApp('content-public', config.logLevel, clock, deps.logger);
  let states: Readonly<Record<string, OperationState>> = {};
  // Todas sus operaciones son anónimas (`security: []`): no lleva SecurityAdapter.
  states = registerContract(app, {
    contract: await readContract(PUBLIC_CONTRACT),
    appEnv: config.appEnv,
    handlers: {
      ...healthHandlers({ appEnv: config.appEnv, checks: { contract: async () => 'ok' }, operations: () => states }),
    },
  });
  return app;
}
