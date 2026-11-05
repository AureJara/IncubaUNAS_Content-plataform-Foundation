import { contentHash, type Clock, type IdGenerator } from '@incubaunas/shared-kernel';
import { buildEnvelope, type EventEnvelope } from '@incubaunas/events';
import { ROLE_SCOPES, type RequestContext, type Role } from '@incubaunas/tenancy';
import type { MembershipSnapshot } from '../domain/membership.js';
import type { OrganizationSnapshot, OrganizationState } from '../domain/organization.js';

type EventContext = Pick<RequestContext, 'actor'>;

/** Construye los eventos que Platform publica, siempre sin datos personales. */
export class DomainEvents {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  organizationLifecycleChanged(
    ctx: EventContext,
    organization: OrganizationSnapshot,
    previous: OrganizationState | null,
  ): EventEnvelope {
    return buildEnvelope(
      {
        topic: 'platform.organization.lifecycle_changed.v1',
        producer: 'platform',
        organizationId: organization.id,
        aggregate: { type: 'organization', id: organization.id, version: organization.revision },
        actor: ctx.actor,
        occurredAt: this.clock.now(),
        data: {
          organization_id: organization.id,
          previous_state: previous,
          current_state: organization.state,
          effective_at: organization.updatedAt.toISOString(),
        },
      },
      { ids: this.ids, clock: this.clock },
    );
  }

  membershipChanged(ctx: EventContext, membership: MembershipSnapshot): EventEnvelope {
    return buildEnvelope(
      {
        topic: 'platform.membership.changed.v1',
        producer: 'platform',
        organizationId: membership.organizationId,
        aggregate: { type: 'membership', id: membership.id, version: membership.revision },
        actor: ctx.actor,
        occurredAt: this.clock.now(),
        data: {
          membership_id: membership.id,
          user_id: membership.userId,
          roles_scopes_hash: rolesScopesHash(membership),
          state: membership.state,
        },
      },
      { ids: this.ids, clock: this.clock },
    );
  }
}

/** Hash de lo que el miembro puede hacer: los consumidores invalidan cachés si cambia. */
export function rolesScopesHash(
  membership: Pick<MembershipSnapshot, 'roles' | 'restrictions'>,
): string {
  const roles = [...membership.roles].sort();
  const scopes = [...new Set(roles.flatMap((role: Role) => ROLE_SCOPES[role]))].sort();
  const restrictions = membership.restrictions.map((r) => ({
    type: r.type,
    id: r.id,
    validUntil: r.validUntil?.toISOString() ?? null,
  }));
  return contentHash({ roles, scopes, restrictions });
}
