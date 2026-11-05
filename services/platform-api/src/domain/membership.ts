import {
  AppError,
  invalidTransition,
  validationFailed,
  type Uuid,
} from '@incubaunas/shared-kernel';
import { isRole, type Restriction, type Role } from '@incubaunas/tenancy';

export type MembershipState = 'invited' | 'active' | 'suspended' | 'revoked' | 'expired';

const TRANSITIONS: Readonly<Record<MembershipState, readonly MembershipState[]>> = {
  invited: ['active', 'expired', 'revoked'],
  active: ['suspended', 'revoked'],
  suspended: ['active', 'revoked'],
  revoked: [],
  expired: [],
};

export interface MembershipSnapshot {
  id: Uuid;
  organizationId: Uuid;
  userId: Uuid;
  state: MembershipState;
  roles: Role[];
  restrictions: Restriction[];
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export function assertRoles(roles: readonly string[], pointer = '/roles'): Role[] {
  const unique = [...new Set(roles)];
  const invalid = unique.filter((role) => !isRole(role));
  if (unique.length === 0 || invalid.length > 0) {
    throw validationFailed('Los roles no son válidos.', [
      { pointer, code: 'invalid', message: 'Indica al menos un rol de la lista permitida.' },
    ]);
  }
  return unique as Role[];
}

export class Membership {
  private constructor(private props: MembershipSnapshot) {}

  /** Una persona entra a una organización con sus roles ya activos (la invitación se aceptó). */
  static join(
    input: {
      id: Uuid;
      organizationId: Uuid;
      userId: Uuid;
      roles: readonly string[];
      restrictions?: Restriction[];
    },
    now: Date,
  ): Membership {
    return new Membership({
      id: input.id,
      organizationId: input.organizationId,
      userId: input.userId,
      state: 'active',
      roles: assertRoles(input.roles),
      restrictions: input.restrictions ?? [],
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(snapshot: MembershipSnapshot): Membership {
    return new Membership({
      ...snapshot,
      roles: [...snapshot.roles],
      restrictions: [...snapshot.restrictions],
    });
  }

  get snapshot(): MembershipSnapshot {
    return {
      ...this.props,
      roles: [...this.props.roles],
      restrictions: [...this.props.restrictions],
    };
  }

  get id(): Uuid {
    return this.props.id;
  }

  get userId(): Uuid {
    return this.props.userId;
  }

  get state(): MembershipState {
    return this.props.state;
  }

  get revision(): number {
    return this.props.revision;
  }

  get isActiveOwner(): boolean {
    return this.props.state === 'active' && this.props.roles.includes('org_owner');
  }

  changeRoles(roles: readonly string[], now: Date): void {
    if (this.props.state === 'revoked' || this.props.state === 'expired') {
      throw invalidTransition('La membresía', this.props.state, 'con otros roles');
    }
    this.props.roles = assertRoles(roles);
    this.props.updatedAt = now;
  }

  setRestrictions(restrictions: Restriction[], now: Date): void {
    this.props.restrictions = restrictions;
    this.props.updatedAt = now;
  }

  suspend(now: Date): void {
    this.transitionTo('suspended', now);
  }

  reactivate(now: Date): void {
    if (this.props.state !== 'suspended')
      throw invalidTransition('La membresía', this.props.state, 'active');
    this.transitionTo('active', now);
  }

  revoke(now: Date): void {
    this.transitionTo('revoked', now);
  }

  /** Aplica el estado pedido por el cliente mediante la transición que le corresponde. */
  applyState(next: 'active' | 'suspended' | 'revoked', now: Date): void {
    if (next === this.props.state) return;
    if (next === 'active') this.reactivate(now);
    else if (next === 'suspended') this.suspend(now);
    else this.revoke(now);
  }

  private transitionTo(next: MembershipState, now: Date): void {
    if (!TRANSITIONS[this.props.state].includes(next)) {
      throw invalidTransition('La membresía', this.props.state, next);
    }
    this.props.state = next;
    this.props.updatedAt = now;
  }
}

/**
 * Regla de negocio: la organización conserva siempre al menos un owner activo. El trigger diferido
 * de PostgreSQL es la red de seguridad ante carreras; esta función da el error de negocio claro.
 */
export function assertOwnerRemains(input: {
  wasActiveOwner: boolean;
  isActiveOwner: boolean;
  activeOwners: number;
}): void {
  if (input.wasActiveOwner && !input.isActiveOwner && input.activeOwners <= 1) {
    throw new AppError(
      'last_owner_required',
      409,
      'La organización debe conservar al menos un owner activo.',
    );
  }
}
