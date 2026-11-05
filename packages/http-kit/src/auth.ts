import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { AppError, unauthenticated } from '@incubaunas/shared-kernel';
import type { RequestContext } from '@incubaunas/tenancy';

export interface Authenticated {
  context: RequestContext;
  /** Solo para esquemas con cookie: compara el `X-CSRF-Token` con el esperado para la sesión. */
  verifyCsrf?: (token: string | undefined) => boolean;
}

/** Puerto de autenticación para un esquema de seguridad de OpenAPI. */
export interface Authenticator {
  /** `null` si la petición no trae credenciales de este esquema. Lanza si las trae pero son inválidas. */
  authenticate(request: FastifyRequest): Promise<Authenticated | null>;
}

export type AuthenticatorRegistry = Readonly<Record<string, Authenticator>>;

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Hook de `onRequest`: corre antes de parsear el cuerpo, así una petición sin sesión se rechaza con
 * 401 aunque el cuerpo sea inválido. El tenant y el actor salen únicamente de la credencial validada.
 */
export function createAuthHook(registry: AuthenticatorRegistry): preHandlerAsyncHookHandler {
  return async (request) => {
    // Una ruta que no existe no protege nada: la responde el manejador de 404.
    if (request.is404) return;
    const requirements = request.routeOptions.config.security;
    if (requirements !== undefined && requirements.length === 0) return; // operación pública

    const alternatives = requirements ?? [{ sessionCookie: [] }];
    for (const alternative of alternatives) {
      const scheme = Object.keys(alternative)[0];
      const authenticator = scheme ? registry[scheme] : undefined;
      if (!authenticator) continue;

      const authenticated = await authenticator.authenticate(request);
      if (!authenticated) continue;

      if (scheme === 'sessionCookie' && UNSAFE_METHODS.has(request.method)) {
        const header = request.headers['x-csrf-token'];
        const token = Array.isArray(header) ? header[0] : header;
        if (!authenticated.verifyCsrf?.(token)) {
          throw new AppError('csrf_invalid', 403, 'El token CSRF falta o no es válido.');
        }
      }
      request.requestContext = authenticated.context;
      return;
    }
    throw unauthenticated();
  };
}

/** Obtiene el contexto de una ruta autenticada; falla cerrado si el hook no corrió. */
export function contextOf(request: FastifyRequest): RequestContext {
  if (!request.requestContext) throw unauthenticated();
  return request.requestContext;
}
