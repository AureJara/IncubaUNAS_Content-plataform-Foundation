import type { AppEnv } from './env.ts';
import type { OperationHandler, OperationState } from './registrar.ts';

export type CheckStatus = 'ok' | 'failing' | 'not_configured';
export type HealthCheck = () => Promise<CheckStatus>;

const CHECK_TIMEOUT_MS = 2000;

async function runCheck(check: HealthCheck): Promise<CheckStatus> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<CheckStatus>((resolve) => {
    timer = setTimeout(() => resolve('failing'), CHECK_TIMEOUT_MS);
  });
  try {
    return await Promise.race([check().catch((): CheckStatus => 'failing'), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Handlers de `getHealthLive` y `getHealthReady` (spec 9.1). `ready` informa cada dependencia y el estado de cada
 * operación (MOCK-04); responde 503 si alguna dependencia falla.
 */
export function healthHandlers(input: {
  appEnv: AppEnv;
  checks: Readonly<Record<string, HealthCheck>>;
  /** Se lee en cada llamada: el registrar calcula los estados después de crear estos handlers. */
  operations: () => Readonly<Record<string, OperationState>>;
}): { getHealthLive: OperationHandler; getHealthReady: OperationHandler } {
  return {
    getHealthLive: { state: 'real', handle: async () => ({ status: 200, body: { status: 'ok' } }) },
    getHealthReady: {
      state: 'real',
      handle: async () => {
        const names = Object.keys(input.checks);
        const results = await Promise.all(names.map((name) => runCheck(input.checks[name] as HealthCheck)));
        const checks = Object.fromEntries(names.map((name, i) => [name, results[i]]));
        const ready = results.every((status) => status !== 'failing');
        return {
          status: ready ? 200 : 503,
          headers: { 'cache-control': 'no-store' },
          body: {
            status: ready ? 'ready' : 'not_ready',
            environment: input.appEnv,
            checks,
            operations: input.operations(),
          },
        };
      },
    },
  };
}
