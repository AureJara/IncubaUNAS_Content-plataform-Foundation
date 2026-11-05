import { AppError, forbidden, systemClock, type Clock } from '@incubaunas/shared-kernel';
import { RESOURCE_BOUND_SCOPES, ROLE_SCOPES, type Role, type Scope } from './scopes.js';

export type ResourceType = 'site' | 'event' | 'venue';

export interface ResourceRef {
  type: ResourceType;
  id: string;
}

/** Limita los permisos de un miembro a un recurso concreto durante un tiempo opcional. */
export interface Restriction extends ResourceRef {
  validUntil?: Date | null;
}

export interface AuthorizationInit {
  roles?: readonly Role[];
  /** Scopes explícitos, p. ej. los de una cuenta de servicio; se suman a los de los roles. */
  scopes?: readonly Scope[];
  restrictions?: readonly Restriction[];
  authTime: Date;
  amr?: readonly string[];
  clock?: Clock;
}

/** Ventana por defecto de "autenticación reciente" para acciones privilegiadas. */
export const RECENT_AUTH_SECONDS = 10 * 60;

/**
 * Decide qué puede hacer un actor. Los permisos son la unión de los scopes de sus roles menos las
 * restricciones por recurso, y la denegación es el valor por defecto.
 */
export class Authorization {
  readonly roles: readonly Role[];
  readonly restrictions: readonly Restriction[];
  readonly authTime: Date;
  readonly amr: readonly string[];
  private readonly granted: ReadonlySet<Scope>;
  private readonly clock: Clock;

  constructor(init: AuthorizationInit) {
    this.roles = [...new Set(init.roles ?? [])];
    this.restrictions = init.restrictions ?? [];
    this.authTime = init.authTime;
    this.amr = init.amr ?? [];
    this.clock = init.clock ?? systemClock;
    const scopes = new Set<Scope>(init.scopes ?? []);
    for (const role of this.roles) for (const scope of ROLE_SCOPES[role]) scopes.add(scope);
    this.granted = scopes;
  }

  get scopes(): readonly Scope[] {
    return [...this.granted].sort();
  }

  has(scope: Scope): boolean {
    return this.granted.has(scope);
  }

  /**
   * Con un recurso, aplica las restricciones vigentes. Sin recurso (consultas de colección) devuelve
   * `true` si el scope existe: quien lista debe filtrar con {@link allowedResourceIds}.
   */
  allows(scope: Scope, resource?: ResourceRef): boolean {
    if (!this.granted.has(scope)) return false;
    const active = this.activeRestrictions();
    if (active.length === 0 || !RESOURCE_BOUND_SCOPES.has(scope) || resource === undefined) {
      return true;
    }
    return active.some((r) => r.type === resource.type && r.id === resource.id);
  }

  require(scope: Scope, resource?: ResourceRef): void {
    if (!this.allows(scope, resource)) throw forbidden();
  }

  /** `null` significa "sin restricción"; una lista vacía significa "ningún recurso". */
  allowedResourceIds(scope: Scope, type: ResourceType): readonly string[] | null {
    if (!this.granted.has(scope)) return [];
    const active = this.activeRestrictions();
    if (active.length === 0 || !RESOURCE_BOUND_SCOPES.has(scope)) return null;
    return active.filter((r) => r.type === type).map((r) => r.id);
  }

  get recentAuthentication(): boolean {
    const ageSeconds = (this.clock.now().getTime() - this.authTime.getTime()) / 1000;
    return this.amr.includes('mfa') && ageSeconds >= 0 && ageSeconds <= RECENT_AUTH_SECONDS;
  }

  /** Acciones críticas (cuentas de servicio, logout global, exports) exigen MFA reciente. */
  requireRecentAuthentication(): void {
    if (!this.amr.includes('mfa')) {
      throw new AppError('mfa_required', 403, 'Esta acción exige verificación en dos pasos (MFA).');
    }
    if (!this.recentAuthentication) {
      throw new AppError(
        'recent_authentication_required',
        403,
        'Vuelve a autenticarte: esta acción exige una autenticación reciente.',
      );
    }
  }

  private activeRestrictions(): readonly Restriction[] {
    const now = this.clock.now().getTime();
    return this.restrictions.filter((r) => !r.validUntil || r.validUntil.getTime() > now);
  }
}
