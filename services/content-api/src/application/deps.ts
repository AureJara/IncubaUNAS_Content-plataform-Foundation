import { notFound, type Clock, type IdGenerator, type Uuid } from '@incubaunas/shared-kernel';
import type { RequestContext } from '@incubaunas/tenancy';
import type { BlockValidator } from '../domain/blocks.js';
import type {
  AuditEntry,
  MalwareScanner,
  ObjectStorage,
  PublicReadModelReader,
  ReleaseManifestFetcher,
  Repositories,
  TokenGenerator,
  UnitOfWork,
} from './ports.js';

export interface ContentDeps {
  uow: UnitOfWork;
  reader: PublicReadModelReader;
  clock: Clock;
  ids: IdGenerator;
  tokens: TokenGenerator;
  blocks: BlockValidator;
  storage: ObjectStorage;
  scanner: MalwareScanner;
  fetcher: ReleaseManifestFetcher;
  /** Base pública del sitio donde se abre la vista previa. */
  previewBaseUrl: string;
}

/** Tenant del actor: sale del token firmado, nunca de la ruta ni del cuerpo. */
export function ownTenant(ctx: RequestContext): Uuid {
  if (ctx.organizationId === null) throw notFound('La organización activa');
  return ctx.organizationId;
}

export function recordAudit(
  repositories: Repositories,
  deps: Pick<ContentDeps, 'ids' | 'clock'>,
  ctx: Pick<RequestContext, 'actor' | 'requestId'>,
  entry: Omit<AuditEntry, 'actor' | 'requestId'>,
): Promise<void> {
  return repositories.audit.record(
    { ...entry, actor: ctx.actor, requestId: ctx.requestId },
    deps.ids.next(),
    deps.clock.now(),
  );
}
