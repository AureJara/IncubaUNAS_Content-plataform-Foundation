import {
  AppError,
  invalidTransition,
  notFound,
  validationFailed,
  type Uuid,
} from '@incubaunas/shared-kernel';
import { buildEnvelope } from '@incubaunas/events';
import type { RequestContext } from '@incubaunas/tenancy';
import { recordAudit, type PlatformDeps } from './deps.js';
import { idempotent } from './idempotent.js';
import type {
  DomainRecord,
  DomainState,
  DomainVerifier,
  HostRoute,
  Repositories,
} from './ports.js';

const HOSTNAME_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
/** Sufijos que nunca pueden registrarse: apuntan a infraestructura interna o local. */
const FORBIDDEN_SUFFIXES = [
  '.local',
  '.localhost',
  '.internal',
  '.test',
  '.example',
  '.invalid',
  '.lan',
];
const CHALLENGE_LABEL = '_incubaunas-challenge';

export interface DomainCreateInput {
  hostname: string;
  verification_method: 'dns_txt' | 'http_file';
  primary?: boolean;
}

export interface DomainDto {
  id: string;
  organization_id: string;
  site_id: string;
  hostname: string;
  state: DomainState;
  primary: boolean;
  challenge: { method: string; name: string; value: string };
  created_at: string;
  activated_at: string | null;
}

export interface HostResolutionDto {
  hostname: string;
  site_id: string;
  organization_id: string;
}

const toDto = (d: DomainRecord): DomainDto => ({
  id: d.id,
  organization_id: d.organizationId,
  site_id: d.siteId,
  hostname: d.hostname,
  state: d.state,
  primary: d.isPrimary,
  challenge: { method: d.challenge.method, name: d.challenge.name, value: d.challenge.value },
  created_at: d.createdAt.toISOString(),
  activated_at: d.activatedAt?.toISOString() ?? null,
});

/** Normaliza y valida un hostname: DNS válido, sin IPs ni sufijos internos. */
export function assertHostname(raw: string): string {
  const hostname = raw.trim().toLowerCase().replace(/\.$/, '');
  const labels = hostname.split('.');
  const valid =
    hostname.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => HOSTNAME_LABEL.test(label)) &&
    !/^\d+(\.\d+){3}$/.test(hostname) &&
    !FORBIDDEN_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  if (!valid) {
    throw validationFailed('El hostname no es válido.', [
      {
        pointer: '/hostname',
        code: 'invalid',
        message: 'Usa un dominio público, p. ej. eventos.universidad.edu.pe.',
      },
    ]);
  }
  return hostname;
}

// Un dominio solo avanza por estos arcos (STATE-MACHINES.md, más `failed → verifying` para reintentar).
const TRANSITIONS: Readonly<Record<DomainState, readonly DomainState[]>> = {
  pending: ['verifying'],
  verifying: ['active', 'failed'],
  failed: ['verifying'],
  active: ['suspended'],
  suspended: ['active', 'released'],
  released: [],
};

/** PF-021 y PF-022: dominios propios con desafío de verificación y resolución host → sitio. */
export class DomainService {
  constructor(
    private readonly deps: PlatformDeps,
    private readonly verifier: DomainVerifier,
  ) {}

  async register(
    ctx: RequestContext,
    siteId: Uuid,
    input: DomainCreateInput,
    idempotencyKey: string,
  ): Promise<{ value: DomainDto; replayed: boolean }> {
    ctx.authz.require('organizations:admin');
    const organizationId = this.requireOrganization(ctx);
    const { uow, clock, ids, tokens } = this.deps;
    const hostname = assertHostname(input.hostname);

    return uow.run({ organizationId, userId: ctx.userId }, async (r) =>
      idempotent(
        r,
        clock,
        { organizationId, actorId: ctx.actor.id, operation: 'domain.register' },
        idempotencyKey,
        { siteId, ...input, hostname },
        async () => {
          const organization = await r.organizations.findById(organizationId);
          if (organization?.state !== 'active') {
            throw new AppError(
              'invalid_state_transition',
              409,
              'Solo una organización activa puede registrar dominios.',
            );
          }
          const now = clock.now();
          const token = tokens.generate();
          const challenge =
            input.verification_method === 'dns_txt'
              ? {
                  method: 'dns_txt' as const,
                  name: `${CHALLENGE_LABEL}.${hostname}`,
                  value: `incubaunas-verify=${token}`,
                }
              : {
                  method: 'http_file' as const,
                  name: `/.well-known/incubaunas-challenge/${token}`,
                  value: token,
                };
          const domain: DomainRecord = {
            id: ids.next(),
            organizationId,
            siteId,
            hostname,
            state: 'pending',
            isPrimary: input.primary ?? false,
            challenge,
            activatedAt: null,
            revision: 1,
            createdAt: now,
            updatedAt: now,
          };
          await r.domains.insert(domain, ctx.userId ?? null);
          await recordAudit(r, this.deps, ctx, {
            organizationId,
            action: 'domain.registered',
            target: { type: 'domain', id: domain.id },
            outcome: 'success',
            metadata: { hostname },
          });
          return toDto(domain);
        },
      ),
    );
  }

  /**
   * Verifica el desafío. La comprobación de red ocurre FUERA de la transacción para no retener una
   * conexión de la base mientras se espera al DNS o a un servidor externo.
   */
  async verify(ctx: RequestContext, domainId: Uuid): Promise<DomainDto> {
    ctx.authz.require('organizations:admin');
    const organizationId = this.requireOrganization(ctx);
    const { uow, clock } = this.deps;

    const verifying = await uow.run({ organizationId, userId: ctx.userId }, async (r) => {
      const domain = await r.domains.findById(organizationId, domainId);
      if (!domain) throw notFound('El dominio');
      if (domain.state === 'active') return { domain, alreadyActive: true };
      this.assertTransition(domain.state, 'verifying');
      return {
        domain: await r.domains.setState(domain, domain.revision, 'verifying', clock.now()),
        alreadyActive: false,
      };
    });
    if (verifying.alreadyActive) return toDto(verifying.domain);

    let verified = false;
    try {
      verified = await this.verifier.verify(verifying.domain);
    } catch {
      verified = false;
    }

    const outcome = await uow.run({ organizationId, userId: ctx.userId }, async (r) => {
      const fresh = await r.domains.findById(organizationId, domainId);
      if (!fresh) throw notFound('El dominio');
      const now = clock.now();
      const next: DomainState = verified ? 'active' : 'failed';
      this.assertTransition(fresh.state, next);
      const saved = await r.domains.setState(fresh, fresh.revision, next, now);

      if (verified) await this.publishRoute(r, ctx, saved, now);
      await recordAudit(r, this.deps, ctx, {
        organizationId,
        action: verified ? 'domain.activated' : 'domain.verification_failed',
        target: { type: 'domain', id: domainId },
        outcome: verified ? 'success' : 'failure',
        metadata: { hostname: saved.hostname },
      });
      return saved;
    });

    // El estado "failed" ya quedó confirmado arriba; el error se lanza después, fuera de la transacción.
    if (!verified) {
      throw new AppError(
        'domain_verification_failed',
        409,
        'No se pudo verificar el dominio. Revisa el desafío y reintenta.',
      );
    }
    return toDto(outcome);
  }

  /** Resolución pública de un host a su sitio; solo identificadores opacos. */
  async resolve(hostname: string): Promise<HostResolutionDto> {
    const route = await this.deps.uow.run({}, (r) => r.hostRoutes.find(hostname.toLowerCase()));
    if (!route) throw notFound('El dominio');
    return {
      hostname: route.hostname,
      site_id: route.siteId,
      organization_id: route.organizationId,
    };
  }

  private async publishRoute(
    r: Repositories,
    ctx: RequestContext,
    domain: DomainRecord,
    now: Date,
  ): Promise<void> {
    const route: HostRoute = {
      hostname: domain.hostname,
      siteId: domain.siteId,
      organizationId: domain.organizationId,
    };
    await r.hostRoutes.upsert(route, now);
    await r.outbox.append(
      buildEnvelope(
        {
          topic: 'platform.domain.activated.v1',
          producer: 'platform',
          organizationId: domain.organizationId,
          aggregate: { type: 'domain', id: domain.id, version: domain.revision },
          actor: ctx.actor,
          occurredAt: now,
          data: {
            site_id: domain.siteId,
            hostname: domain.hostname,
            primary: domain.isPrimary,
            activated_at: now.toISOString(),
          },
        },
        { ids: this.deps.ids, clock: this.deps.clock },
      ),
    );
  }

  private assertTransition(from: DomainState, to: DomainState): void {
    if (!TRANSITIONS[from].includes(to)) throw invalidTransition('El dominio', from, to);
  }

  private requireOrganization(ctx: RequestContext): Uuid {
    if (!ctx.organizationId) throw notFound('La organización activa');
    return ctx.organizationId;
  }
}
