import { withTenant, type DbClient, type Pool } from '@incubaunas/db';
import { PgOutboxWriter, type EventContractValidator } from '@incubaunas/events';
import type { Clock } from '@incubaunas/shared-kernel';
import type { Repositories, TenantScope, UnitOfWork } from '../../application/ports.js';
import { PgAuditLog, PgIdempotencyStore } from '@incubaunas/service-kit/pg';
import { PgBootstrapStore } from './bootstrap.js';
import { PgInvitationRepository } from './invitations.js';
import { PgMembershipRepository } from './memberships.js';
import { PgOrganizationRepository } from './organizations.js';
import { PgLoginAttemptRepository, PgSessionRepository } from './sessions.js';
import { PgUserRepository } from './users.js';
import {
  PgDomainRepository,
  PgHostRouteRepository,
  PgServiceAccountRepository,
} from './service-accounts-domains.js';

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
      serviceAccounts: new PgServiceAccountRepository(client),
      domains: new PgDomainRepository(client),
      hostRoutes: new PgHostRouteRepository(client),
      users: new PgUserRepository(client),
      organizations: new PgOrganizationRepository(client),
      memberships: new PgMembershipRepository(client),
      invitations: new PgInvitationRepository(client),
      sessions: new PgSessionRepository(client),
      loginAttempts: new PgLoginAttemptRepository(client),
      audit: new PgAuditLog(client),
      idempotency: new PgIdempotencyStore(client),
      bootstrap: new PgBootstrapStore(client),
      outbox: new PgOutboxWriter(client, this.validator, this.clock),
    };
  }
}
