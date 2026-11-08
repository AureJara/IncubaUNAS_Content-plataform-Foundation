import type { FastifyRequest } from 'fastify';
import type { OperationSpec } from './contract.ts';
import { HttpProblem } from './problem.ts';
import type { Principal, SecurityAdapter } from './registrar.ts';

export type AccessDecision = 'ok' | 'forbidden' | 'recent_auth_required';

/** Claims mínimos para armar el `Principal` (spec 9.9). Estructural: http-kit no depende de `authz`. */
export interface PrincipalClaims {
  sub: string;
  organization_id?: string | undefined;
  membership_id?: string | undefined;
  roles: readonly string[];
  scopes: readonly string[];
  amr: readonly string[];
  auth_time?: number | undefined;
}

export function principalFromClaims(claims: PrincipalClaims): Principal {
  const principal: Principal = { subject: claims.sub, roles: claims.roles, scopes: claims.scopes, amr: claims.amr };
  if (claims.organization_id !== undefined) principal.organizationId = claims.organization_id;
  if (claims.membership_id !== undefined) principal.membershipId = claims.membership_id;
  if (claims.auth_time !== undefined) principal.authTime = claims.auth_time;
  return principal;
}

export function unauthorized(headers: Record<string, string> = {}): HttpProblem {
  return new HttpProblem({ status: 401, code: 'unauthorized', detail: 'Falta una credencial válida.', headers });
}

/** Lanza el 403 que corresponde a la decisión. */
export function assertAccess(decision: AccessDecision): void {
  if (decision === 'forbidden') {
    throw new HttpProblem({ status: 403, code: 'forbidden', detail: 'No tienes permiso para esta operación.' });
  }
  if (decision === 'recent_auth_required') {
    throw new HttpProblem({
      status: 403,
      code: 'recent_auth_required',
      detail: 'Esta operación pide haber usado MFA en los últimos diez minutos.',
    });
  }
}

export type Decide = (principal: Principal, operation: OperationSpec) => AccessDecision;

/** Lo que exige la operación según sus extensiones `x-required-*` (forma de `Requirement` de `authz`). */
export function requirementOf(operation: OperationSpec): {
  scope: string | undefined;
  role: string | undefined;
  recentMfa: boolean;
} {
  return { scope: operation.requiredScope, role: operation.requiredRole, recentMfa: operation.recentMfa };
}

/** Adaptador a partir de una forma de obtener el `Principal` (token, sesión) y una regla de acceso. */
export function createSecurity(input: {
  authenticate(request: FastifyRequest, operation: OperationSpec): Promise<Principal>;
  decide: Decide;
}): SecurityAdapter {
  return {
    authenticate: input.authenticate,
    authorize: (principal, operation) => assertAccess(input.decide(principal, operation)),
  };
}

const BEARER = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/;

/**
 * Seguridad de los servicios detrás del gateway: lee `Authorization: Bearer` y verifica el token interno. Recibe
 * `verify` y `decide` para no depender de `authz`; cada servicio los conecta en su raíz de composición.
 */
export function createBearerSecurity(input: {
  verify(token: string): Promise<Principal>;
  decide: Decide;
}): SecurityAdapter {
  return createSecurity({
    async authenticate(request) {
      const token = request.headers.authorization?.match(BEARER)?.[1];
      if (token === undefined) throw unauthorized({ 'www-authenticate': 'Bearer' });
      try {
        return await input.verify(token);
      } catch {
        throw unauthorized({ 'www-authenticate': 'Bearer error="invalid_token"' });
      }
    },
    decide: input.decide,
  });
}
