/**
 * Roles y scopes del contrato de autorización (AUTH-AND-AUTHORIZATION-CONTRACT.md).
 * Son datos, no ramas de código: añadir un rol es añadir una fila (Open/Closed).
 */
export const SCOPES = [
  'organizations:admin',
  'sites:write',
  'sites:publish',
  'events:write',
  'events:publish',
  'events:read',
  'participation:read',
  'participation:manage',
  'registration:self',
  'onsite:checkin',
  'onsite:void',
  'communications:send',
  'reports:read',
  'reports:export_sensitive',
  'certificates:issue',
  'certificates:revoke',
  'platform:admin',
] as const;
export type Scope = (typeof SCOPES)[number];

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

/** Scopes que no se conceden por rol: pertenecen al participante o a la plataforma. */
const NOT_ROLE_GRANTABLE: readonly Scope[] = ['registration:self', 'platform:admin'];

export const ROLE_SCOPES: Readonly<Record<Role, readonly Scope[]>> = {
  org_owner: SCOPES.filter((scope) => !NOT_ROLE_GRANTABLE.includes(scope)),
  security_admin: ['organizations:admin'],
  site_editor: ['sites:write', 'sites:publish'],
  event_manager: [
    'events:write',
    'events:publish',
    'events:read',
    'participation:read',
    'participation:manage',
    'communications:send',
    'certificates:issue',
    'certificates:revoke',
    'reports:read',
  ],
  application_reviewer: ['participation:read', 'participation:manage'],
  checkin_staff: ['onsite:checkin'],
  checkin_supervisor: ['onsite:checkin', 'onsite:void'],
  report_viewer: ['reports:read'],
};

/** Scopes cuyo alcance se puede limitar a un evento o una sede concretos. */
export const RESOURCE_BOUND_SCOPES: ReadonlySet<Scope> = new Set<Scope>([
  'events:write',
  'events:publish',
  'events:read',
  'participation:read',
  'participation:manage',
  'onsite:checkin',
  'onsite:void',
  'reports:read',
  'certificates:issue',
  'certificates:revoke',
]);

export const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value);

export const isScope = (value: unknown): value is Scope =>
  typeof value === 'string' && (SCOPES as readonly string[]).includes(value);

/** Un scope de plataforma nunca puede delegarse a una cuenta de servicio de una organización. */
export const isDelegableScope = (scope: Scope): boolean => scope !== 'platform:admin';
