import {
  clampLimit,
  decodeCursor,
  encodeCursor,
  forbidden,
  notFound,
  staleRevision,
  toPage,
  type Page,
  type Uuid,
} from '@incubaunas/shared-kernel';
import type { Restriction, RequestContext, Role } from '@incubaunas/tenancy';
import { assertOwnerRemains, type MembershipState } from '../domain/membership.js';
import { toMembershipDto, type MembershipDto } from './dto.js';
import { ownTenant, recordAudit, resolveTenant, type PlatformDeps } from './deps.js';

export interface MembershipPatchInput {
  roles?: string[];
  state?: 'active' | 'suspended' | 'revoked';
  restrictions?: {
    resource_type: 'site' | 'event' | 'venue';
    resource_id: string;
    valid_until?: string;
  }[];
}

export interface ListMembershipsInput {
  state?: MembershipState;
  role?: Role;
  limit?: number;
  cursor?: string;
}

export class MembershipService {
  constructor(private readonly deps: PlatformDeps) {}

  async list(
    ctx: RequestContext,
    organizationId: Uuid,
    input: ListMembershipsInput,
  ): Promise<Page<MembershipDto>> {
    ctx.authz.require('organizations:admin');
    const tenant = resolveTenant(ctx, organizationId);
    const limit = clampLimit(input.limit);
    const after = decodeCursor<{ createdAt: string; id: string }>(input.cursor);

    return this.deps.uow.run({ organizationId: tenant, userId: ctx.userId }, async (r) => {
      const rows = await r.memberships.list(
        organizationId,
        { state: input.state, role: input.role },
        limit + 1,
        after,
      );
      const page = toPage(rows, limit, (row) =>
        encodeCursor({ createdAt: row.membership.createdAt.toISOString(), id: row.membership.id }),
      );
      return {
        items: page.items.map((row) =>
          // `organizations:admin` ya se exigió arriba, por eso el correo se muestra completo.
          toMembershipDto(
            row,
            row.emailCiphertext ? this.deps.pii.decrypt(row.emailCiphertext) : null,
          ),
        ),
        next_cursor: page.next_cursor,
      };
    });
  }

  /** PF-008: cambia roles, suspende o revoca. Nunca deja a la organización sin owner. */
  async update(
    ctx: RequestContext,
    membershipId: Uuid,
    patch: MembershipPatchInput,
    expectedRevision: number,
  ): Promise<MembershipDto> {
    ctx.authz.require('organizations:admin');
    const organizationId = ownTenant(ctx);
    const { uow, clock, events, pii } = this.deps;

    return uow.run({ organizationId, userId: ctx.userId }, async (r) => {
      const membership = await r.memberships.findById(organizationId, membershipId);
      if (!membership) throw notFound('La membresía');
      if (membership.revision !== expectedRevision) throw staleRevision();

      const before = membership.snapshot;
      const wasActiveOwner = membership.isActiveOwner;
      const now = clock.now();

      if (patch.roles) {
        // Solo un owner puede otorgar o quitar el rol de owner.
        const touchesOwner =
          patch.roles.includes('org_owner') !== before.roles.includes('org_owner');
        if (
          touchesOwner &&
          !ctx.authz.roles.includes('org_owner') &&
          !ctx.authz.has('platform:admin')
        ) {
          throw forbidden('Solo un owner puede otorgar o retirar el rol de owner.');
        }
        membership.changeRoles(patch.roles, now);
      }
      if (patch.restrictions)
        membership.setRestrictions(patch.restrictions.map(toRestriction), now);
      if (patch.state) membership.applyState(patch.state, now);

      assertOwnerRemains({
        wasActiveOwner,
        isActiveOwner: membership.isActiveOwner,
        activeOwners: await r.memberships.countActiveOwners(organizationId),
      });

      const saved = await r.memberships.update(membership, expectedRevision, ctx.userId ?? null);
      if (saved.state === 'suspended' || saved.state === 'revoked') {
        await r.sessions.revokeForUserInOrganization(
          saved.userId,
          organizationId,
          now,
          `membership_${saved.state}`,
        );
      }
      await recordAudit(r, this.deps, ctx, {
        organizationId,
        action: 'membership.updated',
        target: { type: 'membership', id: membershipId },
        outcome: 'success',
        metadata: { state: saved.state, roles: saved.snapshot.roles.join(',') },
      });
      await r.outbox.append(events.membershipChanged(ctx, saved.snapshot));

      const user = await r.users.findById(saved.userId);
      return toMembershipDto(
        {
          membership: saved.snapshot,
          displayName: user?.displayName ?? null,
          emailCiphertext: user?.emailCiphertext ?? null,
        },
        user?.emailCiphertext ? pii.decrypt(user.emailCiphertext) : null,
      );
    });
  }
}

function toRestriction(
  input: NonNullable<MembershipPatchInput['restrictions']>[number],
): Restriction {
  return {
    type: input.resource_type,
    id: input.resource_id,
    validUntil: input.valid_until ? new Date(input.valid_until) : null,
  };
}
