import type { OperationHandler } from '@incuba/http-kit';

/**
 * `getJwks` (spec 9.6): publica la clave pública vigente. Estado `memory`: la clave de desarrollo vive en memoria
 * (MOCK-05); con el gestor de secretos (F0-13) pasa a `real` y publica también la anterior durante la rotación.
 */
export function jwksHandler(keys: readonly object[]): OperationHandler {
  return {
    state: 'memory',
    handle: async () => ({
      status: 200,
      headers: { 'cache-control': 'public, max-age=300' },
      body: { keys },
    }),
  };
}
