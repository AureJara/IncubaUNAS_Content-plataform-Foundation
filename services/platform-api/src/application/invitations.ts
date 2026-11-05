import { AppError, notFound, sha256Hex, type Uuid } from '@incubaunas/shared-kernel';
import { isUuid } from '@incubaunas/shared-kernel';
import type { RequestContext } from '@incubaunas/tenancy';
import { Invitation } from '../domain/invitation.js';
import { Membership } from '../domain/membership.js';
import { assertEmail } from '../domain/value-objects.js';
import {
  maskEmail,
  toInvitationDto,
  toMembershipDto,
  type InvitationDto,
  type MembershipDto,
} from './dto.js';
import { recordAudit, resolveTenant, type PlatformDeps } from './deps.js';
import { idempotent } from './idempotent.js';

export interface InvitationCreateInput {
  email: string;
  roles: string[];
  expires_at: string;
}

/** El token público lleva la organización delante: así se fija el tenant antes de buscarlo. */
interface ParsedToken {
  organizationId: Uuid;
  secret: string;
}

export function parseInvitationToken(token: string): ParsedToken {
  const separator = token.indexOf('.');
  const organizationId = token.slice(0, separator);
  const secret = token.slice(separator + 1);
  if (separator < 0 || !isUuid(organizationId) || secret.length < 20)
    throw notFound('La invitación');
  return { organizationId, secret };
}

interface InvitationDelivery {
  token: string;
  organizationName: string;
  locale: string;
  expiresAt: Date;
}

export class InvitationService {
  constructor(private readonly deps: PlatformDeps) {}

  /** PF-002: invita con roles definidos. El token solo viaja por correo, nunca en la respuesta. */
  async create(
    ctx: RequestContext,
    organizationId: Uuid,
    input: InvitationCreateInput,
    idempotencyKey: string,
  ): Promise<{ value: InvitationDto; replayed: boolean }> {
    ctx.authz.require('organizations:admin');
    const tenant = resolveTenant(ctx, organizationId);
    const { uow, clock, ids, tokens, pii, notifier } = this.deps;

    const email = assertEmail(input.email);
    // El token solo vive en memoria hasta enviar el correo: nunca entra en la respuesta guardada.
    const pending: { delivery: InvitationDelivery | null } = { delivery: null };

    const result = await uow.run({ organizationId: tenant, userId: ctx.userId }, async (r) => {
      return idempotent(
        r,
        clock,
        { organizationId, actorId: ctx.actor.id, operation: 'invitation.create' },
        idempotencyKey,
        { organizationId, ...input, email },
        async () => {
          const organization = await r.organizations.findById(organizationId);
          if (!organization) throw notFound('La organización');
          if (organization.state !== 'active') {
            throw new AppError(
              'invalid_state_transition',
              409,
              'Solo una organización activa puede invitar miembros.',
            );
          }
          if (
            input.roles.includes('org_owner') &&
            !ctx.authz.roles.includes('org_owner') &&
            !ctx.authz.has('platform:admin')
          ) {
            throw new AppError(
              'forbidden',
              403,
              'Solo un owner puede invitar con el rol de owner.',
            );
          }

          const blindIndex = pii.blindIndex(email);
          const existing = await r.users.findByEmailBlindIndex(blindIndex);
          if (existing && (await r.memberships.findCurrentForUser(organizationId, existing.id))) {
            throw new AppError(
              'already_exists',
              409,
              'Esa persona ya es miembro de la organización.',
            );
          }

          const now = clock.now();
          const secret = tokens.generate();
          const invitation = Invitation.issue(
            {
              id: ids.next(),
              organizationId,
              emailCiphertext: pii.encrypt(email),
              emailBlindIndex: blindIndex,
              roles: input.roles,
              tokenHash: sha256Hex(secret),
              expiresAt: new Date(input.expires_at),
            },
            now,
          );
          await r.invitations.insert(invitation, ctx.userId ?? null);
          await recordAudit(r, this.deps, ctx, {
            organizationId,
            action: 'invitation.created',
            target: { type: 'invitation', id: invitation.snapshot.id },
            outcome: 'success',
            metadata: { roles: input.roles.join(',') },
          });

          pending.delivery = {
            token: `${organizationId}.${secret}`,
            organizationName: organization.snapshot.displayName,
            locale: organization.snapshot.locale,
            expiresAt: invitation.snapshot.expiresAt,
          };
          return toInvitationDto(invitation.snapshot, maskEmail(email));
        },
      );
    });

    // El correo sale después del commit y solo la primera vez (una repetición idempotente no reenvía).
    if (pending.delivery && !result.replayed) {
      const message = pending.delivery;
      await notifier.send({
        to: email,
        organizationName: message.organizationName,
        locale: message.locale,
        acceptUrl: `${this.deps.adminBaseUrl}/invitations/${encodeURIComponent(message.token)}`,
        expiresAt: message.expiresAt,
      });
    }
    return result;
  }

  /** PF-003: acepta con identidad verificada; solo la persona invitada puede hacerlo. */
  async accept(ctx: RequestContext, token: string, idempotencyKey: string): Promise<MembershipDto> {
    if (!ctx.userId)
      throw new AppError('unauthenticated', 401, 'Inicia sesión para aceptar la invitación.');
    const { organizationId, secret } = parseInvitationToken(token);
    const { uow, clock, ids, events, pii } = this.deps;

    return uow.run({ organizationId, userId: ctx.userId }, async (r) => {
      const { value } = await idempotent(
        r,
        clock,
        { organizationId, actorId: ctx.actor.id, operation: 'invitation.accept' },
        idempotencyKey,
        { token_hash: sha256Hex(secret) },
        async () => {
          const invitation = await r.invitations.findByTokenHash(organizationId, sha256Hex(secret));
          if (!invitation) throw notFound('La invitación');
          const organization = await r.organizations.findById(organizationId);
          if (!organization || organization.state !== 'active') throw notFound('La invitación');

          const user = await r.users.findById(ctx.userId!);
          const now = clock.now();
          const expectedRevision = invitation.revision;
          invitation.accept(
            { userId: ctx.userId!, emailBlindIndex: user?.emailBlindIndex ?? null },
            now,
          );

          if (await r.memberships.findCurrentForUser(organizationId, ctx.userId!)) {
            throw new AppError('already_exists', 409, 'Ya eres miembro de esta organización.');
          }
          await r.invitations.update(invitation, expectedRevision);

          const membership = Membership.join(
            {
              id: ids.next(),
              organizationId,
              userId: ctx.userId!,
              roles: invitation.snapshot.roles,
            },
            now,
          );
          await r.memberships.insert(membership, ctx.userId!);
          await recordAudit(r, this.deps, ctx, {
            organizationId,
            action: 'invitation.accepted',
            target: { type: 'invitation', id: invitation.snapshot.id },
            outcome: 'success',
          });
          await r.outbox.append(events.membershipChanged(ctx, membership.snapshot));

          return toMembershipDto(
            {
              membership: membership.snapshot,
              displayName: user?.displayName ?? null,
              emailCiphertext: null,
            },
            user?.emailCiphertext ? pii.decrypt(user.emailCiphertext) : null,
          );
        },
      );
      return value;
    });
  }

  /** Rechazar solo exige el token; no hay sesión. */
  async decline(ctx: RequestContext, token: string, idempotencyKey: string): Promise<void> {
    const { organizationId, secret } = parseInvitationToken(token);
    const { uow, clock } = this.deps;

    await uow.run({ organizationId }, async (r) => {
      await idempotent(
        r,
        clock,
        { organizationId, actorId: ctx.actor.id, operation: 'invitation.decline' },
        idempotencyKey,
        { token_hash: sha256Hex(secret) },
        async () => {
          const invitation = await r.invitations.findByTokenHash(organizationId, sha256Hex(secret));
          if (!invitation) throw notFound('La invitación');
          const expectedRevision = invitation.revision;
          invitation.decline(clock.now());
          await r.invitations.update(invitation, expectedRevision);
          await recordAudit(r, this.deps, ctx, {
            organizationId,
            action: 'invitation.declined',
            target: { type: 'invitation', id: invitation.snapshot.id },
            outcome: 'success',
          });
          return null;
        },
      );
    });
  }
}
