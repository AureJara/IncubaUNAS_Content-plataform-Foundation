import type { RequestContext } from '@incubaunas/tenancy';

/** Una alternativa de seguridad de OpenAPI: `{ sessionCookie: [] }` o `{ bearerAuth: [] }`. */
export type SecurityRequirement = Record<string, string[]>;

declare module 'fastify' {
  interface FastifyRequest {
    /** Contexto firmado de la petición; ausente solo en rutas públicas. */
    requestContext?: RequestContext;
  }

  interface FastifyContextConfig {
    operationId?: string;
    /** `[]` marca una operación pública; `undefined` se trata como "requiere autenticación". */
    security?: SecurityRequirement[];
  }
}
