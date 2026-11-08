// Raíz de composición de platform-api (spec 3.4). En el Sprint 0 todas las operaciones responden con su mock de
// contrato (spec 3.8); cada historia conecta aquí su caso de uso.
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
import type { PlatformConfig } from './config.ts';

export const CONTRACT = new URL('../../../contracts/dist/platform.json', import.meta.url);

export interface PlatformDeps {
  config: PlatformConfig;
  clock?: Clock;
  /** Por defecto, contra el JWKS del gateway. */
  verifyToken?: TokenVerifier;
  logger?: boolean;
}

export async function buildPlatformApi(deps: PlatformDeps): Promise<FastifyInstance> {
  const { config } = deps;
  const clock = deps.clock ?? systemClock;
  assertNoMocksOutsideLocal(config.appEnv, { dataSource: config.dataSource });

  const verify =
    deps.verifyToken ??
    createTokenVerifier({ issuer: config.issuer, audience: 'platform-api', keys: config.jwksUrl, clock });

  const app = createHttpApp({
    serviceName: 'platform-api',
    logLevel: config.logLevel,
    clock,
    ...(deps.logger === undefined ? {} : { logger: deps.logger }),
  });

  let states: Readonly<Record<string, OperationState>> = {};
  states = registerContract(app, {
    contract: await readContract(CONTRACT),
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
