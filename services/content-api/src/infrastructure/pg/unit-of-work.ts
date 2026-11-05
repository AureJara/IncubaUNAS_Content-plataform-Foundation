import { withTenant, type DbClient, type Pool } from '@incubaunas/db';
import { PgInboxStore, PgOutboxWriter, type EventContractValidator } from '@incubaunas/events';
import type { Clock } from '@incubaunas/shared-kernel';
import { PgAuditLog, PgIdempotencyStore } from '@incubaunas/service-kit/pg';
import type { Repositories, TenantScope, UnitOfWork } from '../../application/ports.js';
import { PgPublicWriter } from './public-read.js';
import {
  PgEventReleaseRepository,
  PgMediaRepository,
  PgPageRepository,
  PgPreviewTokenRepository,
  PgPublicationRepository,
  PgSiteRepository,
} from './repositories.js';

export class PgUnitOfWork implements UnitOfWork {
  constructor(
    private readonly pool: Pool,
    private readonly validator: EventContractValidator,
    private readonly clock: Clock,
  ) {}

  run<T>(scope: TenantScope, work: (repositories: Repositories) => Promise<T>): Promise<T> {
    return withTenant(this.pool, scope, (client) => work(this.repositoriesFor(client)));
  }

  private repositoriesFor(client: DbClient): Repositories {
    return {
      sites: new PgSiteRepository(client),
      pages: new PgPageRepository(client),
      publications: new PgPublicationRepository(client),
      previewTokens: new PgPreviewTokenRepository(client),
      media: new PgMediaRepository(client),
      eventReleases: new PgEventReleaseRepository(client),
      publicWriter: new PgPublicWriter(client),
      audit: new PgAuditLog(client),
      idempotency: new PgIdempotencyStore(client),
      outbox: new PgOutboxWriter(client, this.validator, this.clock),
      inbox: new PgInboxStore(client, this.clock),
    };
  }
}
