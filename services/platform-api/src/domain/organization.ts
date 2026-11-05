import { invalidTransition, type Uuid } from '@incubaunas/shared-kernel';
import { assertDisplayName, assertLocale, assertSlug, assertTimezone } from './value-objects.js';

export type OrganizationState = 'provisioning' | 'active' | 'suspended' | 'archived';

/** Máquina de estados (contracts/STATE-MACHINES.md). Cualquier arco no listado es 409. */
const TRANSITIONS: Readonly<Record<OrganizationState, readonly OrganizationState[]>> = {
  provisioning: ['active'],
  active: ['suspended', 'archived'],
  suspended: ['active', 'archived'],
  archived: [],
};

export interface OrganizationSnapshot {
  id: Uuid;
  slug: string;
  legalName: string | null;
  displayName: string;
  timezone: string;
  locale: string;
  state: OrganizationState;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationEdit {
  legalName?: string | null;
  displayName?: string;
  timezone?: string;
  locale?: string;
}

export class Organization {
  private constructor(private props: OrganizationSnapshot) {}

  static provision(
    input: {
      id: Uuid;
      slug: string;
      legalName?: string | null;
      displayName: string;
      timezone: string;
      locale: string;
    },
    now: Date,
  ): Organization {
    return new Organization({
      id: input.id,
      slug: assertSlug(input.slug),
      legalName: input.legalName?.trim() || null,
      displayName: assertDisplayName(input.displayName),
      timezone: assertTimezone(input.timezone),
      locale: assertLocale(input.locale),
      state: 'provisioning',
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(snapshot: OrganizationSnapshot): Organization {
    return new Organization({ ...snapshot });
  }

  get snapshot(): OrganizationSnapshot {
    return { ...this.props };
  }

  get id(): Uuid {
    return this.props.id;
  }

  get state(): OrganizationState {
    return this.props.state;
  }

  get revision(): number {
    return this.props.revision;
  }

  activate(now: Date): void {
    this.transitionTo('active', now);
  }

  suspend(now: Date): void {
    this.transitionTo('suspended', now);
  }

  reactivate(now: Date): void {
    if (this.props.state !== 'suspended')
      throw invalidTransition('La organización', this.props.state, 'active');
    this.transitionTo('active', now);
  }

  archive(now: Date): void {
    this.transitionTo('archived', now);
  }

  /** Una organización archivada es de solo lectura; la suspendida se puede seguir editando. */
  edit(patch: OrganizationEdit, now: Date): void {
    if (this.props.state === 'archived') {
      throw invalidTransition('La organización', 'archived', 'editada');
    }
    if (patch.displayName !== undefined)
      this.props.displayName = assertDisplayName(patch.displayName);
    if (patch.timezone !== undefined) this.props.timezone = assertTimezone(patch.timezone);
    if (patch.locale !== undefined) this.props.locale = assertLocale(patch.locale);
    if (patch.legalName !== undefined) this.props.legalName = patch.legalName?.trim() || null;
    this.props.updatedAt = now;
  }

  private transitionTo(next: OrganizationState, now: Date): void {
    if (!TRANSITIONS[this.props.state].includes(next)) {
      throw invalidTransition('La organización', this.props.state, next);
    }
    this.props.state = next;
    this.props.updatedAt = now;
  }
}
