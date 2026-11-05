import { notFound, type Clock, type IdGenerator, type Uuid } from '@incubaunas/shared-kernel';
import type { RequestContext } from '@incubaunas/tenancy';
import type { DomainEvents } from './domain-events.js';
import type {
  AuditEntry,
  InvitationNotifier,
  PiiProtector,
  Repositories,
  TokenGenerator,
  UnitOfWork,
} from './ports.js';

export interface PlatformDeps {
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  tokens: TokenGenerator;
  pii: PiiProtector;
  events: DomainEvents;
  notifier: InvitationNotifier;
  /** URL del Admin shell, base de los enlaces que se envían por correo. */
  adminBaseUrl: string;
}

/**
 * Decide en qué tenant se ejecuta un comando que nombra una organización en la ruta. Quien actúa
 * dentro de una organización solo opera sobre ella; el administrador de plataforma puede operar
 * sobre cualquiera. Una organización ajena responde 404, igual que una inexistente.
 */
export function resolveTenant(ctx: RequestContext, pathOrganizationId: Uuid): Uuid {
  if (ctx.authz.has('platform:admin') || ctx.organizationId === pathOrganizationId)
    return pathOrganizationId;
  throw notFound('La organización');
}

/** El tenant del actor para comandos que no nombran una organización en la ruta. */
export function ownTenant(ctx: RequestContext): Uuid {
  if (ctx.organizationId === null) throw notFound('La organización activa');
  return ctx.organizationId;
}

export function recordAudit(
  repositories: Repositories,
  deps: Pick<PlatformDeps, 'ids' | 'clock'>,
  ctx: Pick<RequestContext, 'actor' | 'requestId'>,
  entry: Omit<AuditEntry, 'actor' | 'requestId'>,
): Promise<void> {
  return repositories.audit.record(
    { ...entry, actor: ctx.actor, requestId: ctx.requestId },
    deps.ids.next(),
    deps.clock.now(),
  );
}
