import {
  AppError,
  contentHash,
  notFound,
  staleRevision,
  type Uuid,
} from '@incubaunas/shared-kernel';
import type { RequestContext } from '@incubaunas/tenancy';
import { Membership } from '../domain/membership.js';
import { Organization, type OrganizationEdit } from '../domain/organization.js';
import { assertEmail } from '../domain/value-objects.js';
import { toOrganizationDto, type OrganizationDto } from './dto.js';
import { resolveTenant, recordAudit, type PlatformDeps } from './deps.js';
import { idempotent } from './idempotent.js';

export interface CreateOrganizationInput {
  slug: string;
  legal_name?: string;
  display_name: string;
  timezone: string;
  locale: string;
  owner_identity: { issuer: string; subject: string; email?: string; display_name?: string };
}

export interface OrganizationPatchInput {
  legal_name?: string | null;
  display_name?: string;
  timezone?: string;
  locale?: string;
}

type Lifecycle = 'suspend' | 'reactivate' | 'archive';

export class OrganizationService {
  constructor(private readonly deps: PlatformDeps) {}

  /** PF-001: alta idempotente de una organización con su primer owner (solo administración de plataforma). */
  async create(
    ctx: RequestContext,
    input: CreateOrganizationInput,
    idempotencyKey: string,
  ): Promise<{ value: OrganizationDto; replayed: boolean }> {
    ctx.authz.require('platform:admin');
    const { uow, clock, ids, pii, events } = this.deps;
    const requestHash = contentHash(input);
    const organizationId = ids.next();

    return uow.run({ organizationId }, async (r) => {
      const prior = await r.bootstrap.find(ctx.actor.id, idempotencyKey);
      if (prior) {
        if (prior.requestHash !== requestHash) {
          throw new AppError(
            'idempotency_key_reused',
            409,
            'La Idempotency-Key ya se usó con otra petición.',
          );
        }
        return { value: prior.response as OrganizationDto, replayed: true };
      }

      const now = clock.now();
      const email = input.owner_identity.email
        ? assertEmail(input.owner_identity.email, '/owner_identity/email')
        : null;

      // La organización nace en `provisioning` y solo pasa a `active` cuando ya tiene su owner.
      const organization = Organization.provision(
        { id: organizationId, ...camelCreate(input) },
        now,
      );

      let owner = await r.users.findByIdentity(
        input.owner_identity.issuer,
        input.owner_identity.subject,
      );
      if (!owner) {
        owner = {
          id: ids.next(),
          displayName: input.owner_identity.display_name?.trim() || null,
          emailCiphertext: email ? pii.encrypt(email) : null,
          emailBlindIndex: email ? pii.blindIndex(email) : null,
        };
        await r.users.insert(
          { ...owner, issuer: input.owner_identity.issuer, subject: input.owner_identity.subject },
          now,
        );
      }

      await r.organizations.insert(organization, ctx.userId ?? null);
      const membership = Membership.join(
        { id: ids.next(), organizationId, userId: owner.id, roles: ['org_owner'] },
        now,
      );
      await r.memberships.insert(membership, ctx.userId ?? null);

      organization.activate(now);
      const saved = await r.organizations.update(
        organization,
        organization.revision,
        ctx.userId ?? null,
      );

      await recordAudit(r, this.deps, ctx, {
        organizationId,
        action: 'organization.created',
        target: { type: 'organization', id: organizationId },
        outcome: 'success',
        metadata: { slug: input.slug },
      });
      await r.outbox.append(
        events.organizationLifecycleChanged(ctx, saved.snapshot, 'provisioning'),
      );
      await r.outbox.append(events.membershipChanged(ctx, membership.snapshot));

      const value = toOrganizationDto(saved.snapshot);
      await r.bootstrap.save(
        ctx.actor.id,
        idempotencyKey,
        organizationId,
        { requestHash, response: value },
        now,
      );
      return { value, replayed: false };
    });
  }

  async get(ctx: RequestContext, organizationId: Uuid): Promise<OrganizationDto> {
    const tenant = resolveTenant(ctx, organizationId);
    return this.deps.uow.run({ organizationId: tenant, userId: ctx.userId }, async (r) => {
      const organization = await r.organizations.findById(organizationId);
      if (!organization) throw notFound('La organización');
      return toOrganizationDto(organization.snapshot);
    });
  }

  /** PF-020: edición con control de concurrencia optimista (If-Match). */
  async update(
    ctx: RequestContext,
    organizationId: Uuid,
    patch: OrganizationPatchInput,
    expectedRevision: number,
  ): Promise<OrganizationDto> {
    ctx.authz.require('organizations:admin');
    const tenant = resolveTenant(ctx, organizationId);
    const { uow, clock } = this.deps;

    return uow.run({ organizationId: tenant, userId: ctx.userId }, async (r) => {
      const organization = await r.organizations.findById(organizationId);
      if (!organization) throw notFound('La organización');
      if (organization.revision !== expectedRevision) throw staleRevision();

      organization.edit(toEdit(patch), clock.now());
      const saved = await r.organizations.update(
        organization,
        expectedRevision,
        ctx.userId ?? null,
      );
      await recordAudit(r, this.deps, ctx, {
        organizationId,
        action: 'organization.updated',
        target: { type: 'organization', id: organizationId },
        outcome: 'success',
        metadata: { fields: Object.keys(patch).sort().join(',') },
      });
      return toOrganizationDto(saved.snapshot);
    });
  }

  suspend(ctx: RequestContext, organizationId: Uuid, reason: string, key: string) {
    return this.changeLifecycle(ctx, organizationId, reason, key, 'suspend');
  }

  reactivate(ctx: RequestContext, organizationId: Uuid, reason: string, key: string) {
    return this.changeLifecycle(ctx, organizationId, reason, key, 'reactivate');
  }

  archive(ctx: RequestContext, organizationId: Uuid, reason: string, key: string) {
    return this.changeLifecycle(ctx, organizationId, reason, key, 'archive');
  }

  private async changeLifecycle(
    ctx: RequestContext,
    organizationId: Uuid,
    reason: string,
    key: string,
    action: Lifecycle,
  ): Promise<OrganizationDto> {
    ctx.authz.require('platform:admin');
    const { uow, clock, events } = this.deps;

    return uow.run({ organizationId }, async (r) => {
      const { value } = await idempotent(
        r,
        clock,
        { organizationId, actorId: ctx.actor.id, operation: `organization.${action}` },
        key,
        { organizationId, reason },
        async () => {
          const organization = await r.organizations.findById(organizationId);
          if (!organization) throw notFound('La organización');

          const previous = organization.state;
          const now = clock.now();
          organization[action](now);
          const saved = await r.organizations.update(
            organization,
            organization.revision,
            ctx.userId ?? null,
          );

          // Suspender o archivar corta las sesiones de la organización de inmediato.
          if (action !== 'reactivate') {
            await r.sessions.revokeAllInOrganization(
              organizationId,
              now,
              `organization_${saved.state}`,
            );
          }
          await recordAudit(r, this.deps, ctx, {
            organizationId,
            action: `organization.${action}`,
            target: { type: 'organization', id: organizationId },
            outcome: 'success',
            metadata: { reason: reason.slice(0, 200) },
          });
          await r.outbox.append(events.organizationLifecycleChanged(ctx, saved.snapshot, previous));
          return toOrganizationDto(saved.snapshot);
        },
      );
      return value;
    });
  }
}

function camelCreate(input: CreateOrganizationInput) {
  return {
    slug: input.slug,
    legalName: input.legal_name ?? null,
    displayName: input.display_name,
    timezone: input.timezone,
    locale: input.locale,
  };
}

function toEdit(patch: OrganizationPatchInput): OrganizationEdit {
  return {
    ...(patch.display_name !== undefined ? { displayName: patch.display_name } : {}),
    ...(patch.legal_name !== undefined ? { legalName: patch.legal_name } : {}),
    ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
    ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
  };
}
