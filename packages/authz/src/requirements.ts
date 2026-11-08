import { PLATFORM_ADMIN } from './roles.ts';

/** Lo que exige una operación, tomado de `x-required-scope`, `x-required-role` y `x-recent-mfa` del contrato. */
export interface Requirement {
  scope?: string | undefined;
  role?: string | undefined;
  recentMfa?: boolean | undefined;
}

/** Lo que trae el llamador, ya verificado. */
export interface Grant {
  roles: readonly string[];
  scopes: readonly string[];
  amr: readonly string[];
  /** Segundos desde epoch. */
  authTime?: number | undefined;
}

export type Decision = 'ok' | 'forbidden' | 'recent_auth_required';

/** Ventana de "MFA reciente" (spec 1.6): diez minutos. */
export const RECENT_MFA_SECONDS = 600;

/**
 * Decide si el llamador cumple la operación (spec 1.6). El scope sale del token; un rol exigido se cumple con ese rol
 * o con `org_owner`, salvo `platform_admin`, que solo se cumple consigo mismo. El MFA reciente pide `mfa` en `amr` y
 * `auth_time` de hace menos de diez minutos.
 */
export function checkRequirement(grant: Grant, requirement: Requirement, nowSeconds: number): Decision {
  if (!hasScope(grant, requirement.scope) || !hasRole(grant, requirement.role)) return 'forbidden';
  if (requirement.recentMfa === true && !hasRecentMfa(grant, nowSeconds)) return 'recent_auth_required';
  return 'ok';
}

function hasScope(grant: Grant, scope: string | undefined): boolean {
  return scope === undefined || grant.scopes.includes(scope);
}

function hasRole(grant: Grant, role: string | undefined): boolean {
  if (role === undefined || grant.roles.includes(role)) return true;
  return role !== PLATFORM_ADMIN && grant.roles.includes('org_owner');
}

function hasRecentMfa(grant: Grant, nowSeconds: number): boolean {
  const recent = grant.authTime !== undefined && nowSeconds - grant.authTime <= RECENT_MFA_SECONDS;
  return grant.amr.includes('mfa') && recent;
}
