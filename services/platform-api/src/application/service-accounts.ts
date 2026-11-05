import {
  AppError,
  notFound,
  sha256Hex,
  validationFailed,
  type Uuid,
} from '@incubaunas/shared-kernel';
import { isDelegableScope, isScope, type RequestContext, type Scope } from '@incubaunas/tenancy';
import { recordAudit, resolveTenant, type PlatformDeps } from './deps.js';
import { idempotent } from './idempotent.js';
import type { ServiceAccountRecord } from './ports.js';

const MAX_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;
/** Durante una rotación la credencial anterior sigue válida este tiempo para no cortar a los clientes. */
const ROTATION_OVERLAP_MS = 24 * 60 * 60 * 1000;

export interface ServiceAccountCreateInput {
  name: string;
  auth_method: 'client_secret' | 'private_key_jwt';
  scopes: string[];
  audiences: string[];
  expires_at: string;
  public_jwk?: Record<string, unknown>;
}

export interface ServiceAccountDto {
  id: string;
  organization_id: string;
  name: string;
  auth_method: string;
  scopes: string[];
  audiences: string[];
  state: string;
  expires_at: string;
  created_at: string;
  client_secret?: string | null;
}

const toDto = (a: ServiceAccountRecord): ServiceAccountDto => ({
  id: a.id,
  organization_id: a.organizationId,
  name: a.name,
  auth_method: a.authMethod,
  scopes: a.scopes,
  audiences: a.audiences,
  state: a.state,
  expires_at: a.expiresAt.toISOString(),
  created_at: a.createdAt.toISOString(),
});

/** Una clave pública JWK nunca debe traer parámetros privados. */
function assertPublicJwk(jwk: Record<string, unknown> | undefined): Record<string, unknown> {
  const privateParams = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'k'];
  if (!jwk || typeof jwk.kty !== 'string' || privateParams.some((p) => p in jwk)) {
    throw validationFailed('La clave pública no es válida.', [
      {
        pointer: '/public_jwk',
        code: 'invalid',
        message: 'Envía solo la parte pública de la clave (sin d, p, q…).',
      },
    ]);
  }
  return jwk;
}

/** PF-011: credenciales de máquina con scopes mínimos, audiencia exacta y vencimiento. */
export class ServiceAccountService {
  constructor(private readonly deps: PlatformDeps) {}

  async create(
    ctx: RequestContext,
    organizationId: Uuid,
    input: ServiceAccountCreateInput,
    idempotencyKey: string,
  ): Promise<{ value: ServiceAccountDto; replayed: boolean }> {
    ctx.authz.require('organizations:admin');
    ctx.authz.requireRecentAuthentication();
    const tenant = resolveTenant(ctx, organizationId);
    const { uow, clock, ids, tokens } = this.deps;
    const now = clock.now();

    const scopes = [...new Set(input.scopes)];
    const invalid = scopes.filter((s) => !isScope(s) || !isDelegableScope(s));
    // Mínimo privilegio: nadie delega más de lo que él mismo puede hacer.
    const exceeding = scopes.filter((s) => isScope(s) && !ctx.authz.has(s as Scope));
    if (invalid.length || exceeding.length) {
      throw validationFailed('Los scopes solicitados no están permitidos.', [
        {
          pointer: '/scopes',
          code: 'not_allowed',
          message: 'Usa scopes delegables que tú mismo tengas.',
        },
      ]);
    }
    const expiresAt = new Date(input.expires_at);
    if (
      expiresAt.getTime() <= now.getTime() ||
      expiresAt.getTime() - now.getTime() > MAX_LIFETIME_MS
    ) {
      throw validationFailed('El vencimiento no es válido.', [
        {
          pointer: '/expires_at',
          code: 'range',
          message: 'Debe ser futuro y de un año como máximo.',
        },
      ]);
    }
    const publicJwk =
      input.auth_method === 'private_key_jwt' ? assertPublicJwk(input.public_jwk) : null;

    // El secreto se genera aquí y no se persiste: solo el primer cliente lo ve.
    const secret = input.auth_method === 'client_secret' ? tokens.generate() : null;

    return uow.run({ organizationId: tenant, userId: ctx.userId }, async (r) => {
      const result = await idempotent(
        r,
        clock,
        { organizationId, actorId: ctx.actor.id, operation: 'service_account.create' },
        idempotencyKey,
        { organizationId, ...input },
        async () => {
          const account: ServiceAccountRecord = {
            id: ids.next(),
            organizationId,
            name: input.name.trim(),
            authMethod: input.auth_method,
            scopes,
            audiences: [...new Set(input.audiences)],
            state: 'active',
            expiresAt,
            revision: 1,
            createdAt: now,
            updatedAt: now,
          };
          await r.serviceAccounts.insert(account, ctx.userId ?? null);
          await r.serviceAccounts.insertCredential({
            id: ids.next(),
            serviceAccountId: account.id,
            organizationId,
            secretHash: secret ? sha256Hex(secret) : null,
            publicJwk,
            expiresAt,
            createdAt: now,
          });
          await recordAudit(r, this.deps, ctx, {
            organizationId,
            action: 'service_account.created',
            target: { type: 'service_account', id: account.id },
            outcome: 'success',
            metadata: { scopes: scopes.join(',') },
          });
          // Lo que se guarda para repetir la petición NO incluye el secreto.
          return toDto(account);
        },
      );
      return {
        value: { ...result.value, client_secret: result.replayed ? null : secret },
        replayed: result.replayed,
      };
    });
  }

  async rotate(
    ctx: RequestContext,
    serviceAccountId: Uuid,
    input: { expires_at: string; public_jwk?: Record<string, unknown> },
    idempotencyKey: string,
  ): Promise<{ value: ServiceAccountDto; replayed: boolean }> {
    ctx.authz.require('organizations:admin');
    ctx.authz.requireRecentAuthentication();
    const organizationId = this.requireOrganization(ctx);
    const { uow, clock, ids, tokens } = this.deps;
    const now = clock.now();
    const expiresAt = new Date(input.expires_at);
    if (
      expiresAt.getTime() <= now.getTime() ||
      expiresAt.getTime() - now.getTime() > MAX_LIFETIME_MS
    ) {
      throw validationFailed('El vencimiento no es válido.', [
        {
          pointer: '/expires_at',
          code: 'range',
          message: 'Debe ser futuro y de un año como máximo.',
        },
      ]);
    }
    let secret: string | null = null;

    return uow.run({ organizationId, userId: ctx.userId }, async (r) => {
      const result = await idempotent(
        r,
        clock,
        { organizationId, actorId: ctx.actor.id, operation: 'service_account.rotate' },
        idempotencyKey,
        { serviceAccountId, ...input },
        async () => {
          const account = await r.serviceAccounts.findById(organizationId, serviceAccountId);
          if (!account) throw notFound('La cuenta de servicio');
          if (account.state !== 'active')
            throw new AppError('invalid_state_transition', 409, 'La cuenta está revocada.');

          const credentialId = ids.next();
          secret = account.authMethod === 'client_secret' ? tokens.generate() : null;
          await r.serviceAccounts.insertCredential({
            id: credentialId,
            serviceAccountId,
            organizationId,
            secretHash: secret ? sha256Hex(secret) : null,
            publicJwk:
              account.authMethod === 'private_key_jwt' ? assertPublicJwk(input.public_jwk) : null,
            expiresAt,
            createdAt: now,
          });
          await r.serviceAccounts.shortenActiveCredentials(
            serviceAccountId,
            new Date(now.getTime() + ROTATION_OVERLAP_MS),
            credentialId,
          );
          await recordAudit(r, this.deps, ctx, {
            organizationId,
            action: 'service_account.rotated',
            target: { type: 'service_account', id: serviceAccountId },
            outcome: 'success',
          });
          return toDto(account);
        },
      );
      // El secreto nunca se guarda con la respuesta repetible: una repetición no rota ni lo revela.
      return {
        value: { ...result.value, client_secret: result.replayed ? null : secret },
        replayed: result.replayed,
      };
    });
  }

  async revoke(
    ctx: RequestContext,
    serviceAccountId: Uuid,
    reason: string,
  ): Promise<ServiceAccountDto> {
    ctx.authz.require('organizations:admin');
    const organizationId = this.requireOrganization(ctx);
    const { uow, clock } = this.deps;

    return uow.run({ organizationId, userId: ctx.userId }, async (r) => {
      const revoked = await r.serviceAccounts.revoke(organizationId, serviceAccountId, clock.now());
      if (!revoked) throw notFound('La cuenta de servicio');
      await recordAudit(r, this.deps, ctx, {
        organizationId,
        action: 'service_account.revoked',
        target: { type: 'service_account', id: serviceAccountId },
        outcome: 'success',
        metadata: { reason: reason.slice(0, 200) },
      });
      return toDto(revoked);
    });
  }

  private requireOrganization(ctx: RequestContext): Uuid {
    if (!ctx.organizationId) throw notFound('La organización activa');
    return ctx.organizationId;
  }
}
