import {
  clampLimit,
  decodeCursor,
  encodeCursor,
  forbidden,
  toPage,
  type Page,
} from '@incubaunas/shared-kernel';
import type { RequestContext, ResourceType } from '@incubaunas/tenancy';
import { toRestrictionDto, type RestrictionDto } from './dto.js';
import { ownTenant, recordAudit, resolveTenant, type PlatformDeps } from './deps.js';

export interface MeDto {
  user_id: string;
  display_name: string | null;
  email: string | null;
  active_organization_id: string | null;
  roles: string[];
  scopes: string[];
  amr: string[];
  auth_time: string;
}

export interface CapabilitiesDto {
  organization_id: string;
  roles: string[];
  scopes: string[];
  restrictions: RestrictionDto[];
  recent_authentication: boolean;
}

export interface OrganizationSummaryDto {
  organization_id: string;
  slug: string;
  display_name: string;
  roles: string[];
  active: boolean;
}

export interface AuditEventDto {
  id: string;
  occurred_at: string;
  actor: { type: string; id: string };
  action: string;
  target: { type: string; id: string };
  outcome: string;
  request_id: string;
}

/** Consultas del propio usuario (PF-006, PF-009) y auditoría de la organización (PF-012). */
export class MeService {
  constructor(private readonly deps: PlatformDeps) {}

  async getMe(ctx: RequestContext): Promise<MeDto> {
    if (!ctx.userId) throw forbidden('Este recurso es para personas autenticadas.');
    const user = await this.deps.uow.run({}, (r) => r.users.findById(ctx.userId!));
    return {
      user_id: ctx.userId,
      display_name: user?.displayName ?? null,
      email: user?.emailCiphertext ? this.deps.pii.decrypt(user.emailCiphertext) : null,
      active_organization_id: ctx.organizationId,
      roles: [...ctx.authz.roles],
      scopes: [...ctx.authz.scopes],
      amr: [...ctx.authz.amr],
      auth_time: ctx.authz.authTime.toISOString(),
    };
  }

  capabilities(
    ctx: RequestContext,
    resource?: { type: ResourceType; id: string },
  ): CapabilitiesDto {
    const organizationId = ownTenant(ctx);
    // Con un recurso, solo se devuelven los scopes que de verdad aplican a ese recurso.
    const scopes = resource
      ? ctx.authz.scopes.filter((scope) => ctx.authz.allows(scope, resource))
      : ctx.authz.scopes;
    return {
      organization_id: organizationId,
      roles: [...ctx.authz.roles],
      scopes: [...scopes],
      restrictions: ctx.authz.restrictions.map(toRestrictionDto),
      recent_authentication: ctx.authz.recentAuthentication,
    };
  }

  async listMyOrganizations(ctx: RequestContext): Promise<Page<OrganizationSummaryDto>> {
    if (!ctx.userId) throw forbidden('Este recurso es para personas autenticadas.');
    const memberships = await this.deps.uow.run({ userId: ctx.userId }, (r) =>
      r.memberships.listActiveForUser(ctx.userId!),
    );
    return {
      items: memberships.map((m) => ({
        organization_id: m.organization.id,
        slug: m.organization.slug,
        display_name: m.organization.displayName,
        roles: m.roles,
        active: m.organization.id === ctx.organizationId,
      })),
      next_cursor: null,
    };
  }

  async listAuditEvents(
    ctx: RequestContext,
    organizationId: string,
    input: { action?: string; from?: string; to?: string; limit?: number; cursor?: string },
  ): Promise<Page<AuditEventDto>> {
    ctx.authz.require('organizations:admin');
    const tenant = resolveTenant(ctx, organizationId);
    const limit = clampLimit(input.limit);
    const after = decodeCursor<{ occurredAt: string; id: string }>(input.cursor);

    return this.deps.uow.run({ organizationId: tenant, userId: ctx.userId }, async (r) => {
      const rows = await r.audit.list(
        organizationId,
        {
          action: input.action,
          from: input.from ? new Date(input.from) : undefined,
          to: input.to ? new Date(input.to) : undefined,
        },
        limit + 1,
        after,
      );
      const page = toPage(rows, limit, (row) =>
        encodeCursor({ occurredAt: row.occurredAt.toISOString(), id: row.id }),
      );
      // Consultar la auditoría también deja rastro, pero sin cambiar lo que se acaba de listar.
      await recordAudit(r, this.deps, ctx, {
        organizationId,
        action: 'audit.queried',
        target: { type: 'organization', id: organizationId },
        outcome: 'success',
      });
      return {
        items: page.items.map((row) => ({
          id: row.id,
          occurred_at: row.occurredAt.toISOString(),
          actor: row.actor,
          action: row.action,
          target: row.target,
          outcome: row.outcome,
          request_id: row.requestId,
        })),
        next_cursor: page.next_cursor,
      };
    });
  }
}
