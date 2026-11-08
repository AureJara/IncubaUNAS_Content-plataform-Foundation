/** Roles de tenant (spec 1.6). Coinciden con `Role` de contracts/openapi/common.yaml. */
export const ROLES = [
  'org_owner',
  'security_admin',
  'site_editor',
  'event_manager',
  'application_reviewer',
  'checkin_staff',
  'checkin_supervisor',
  'report_viewer',
] as const;
export type Role = (typeof ROLES)[number];

/**
 * Rol de plataforma, fuera de los tenants. El catálogo lo usa pero no está en la lista de roles (spec 12, punto
 * abierto 7): mientras Arquitectura no lo defina, viaja en el claim `roles` como un rol más.
 */
export const PLATFORM_ADMIN = 'platform_admin';

export const SCOPES = [
  'organizations:admin',
  'sites:write',
  'sites:publish',
  'events:write',
  'events:publish',
  'participation:read',
  'participation:manage',
  'communications:send',
  'onsite:checkin',
  'onsite:void',
  'reports:read',
] as const;
export type Scope = (typeof SCOPES)[number];

/** Scopes de cada rol (spec 1.6). `org_owner` tiene todos. */
export const ROLE_SCOPES: Readonly<Record<Role, readonly Scope[]>> = {
  org_owner: SCOPES,
  security_admin: ['organizations:admin'],
  site_editor: ['sites:write', 'sites:publish'],
  event_manager: [
    'events:write',
    'events:publish',
    'participation:read',
    'participation:manage',
    'communications:send',
  ],
  application_reviewer: ['participation:read'],
  checkin_staff: ['onsite:checkin'],
  checkin_supervisor: ['onsite:checkin', 'onsite:void'],
  report_viewer: ['reports:read'],
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Scopes efectivos de un conjunto de roles, sin repetir y en el orden del catálogo. */
export function scopesForRoles(roles: readonly string[]): Scope[] {
  const granted = new Set(roles.filter(isRole).flatMap((role) => ROLE_SCOPES[role]));
  return SCOPES.filter((scope) => granted.has(scope));
}
