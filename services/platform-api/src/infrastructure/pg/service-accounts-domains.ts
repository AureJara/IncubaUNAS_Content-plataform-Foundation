import { AppError, staleRevision, type Uuid } from '@incubaunas/shared-kernel';
import { isUniqueViolation, type DbClient } from '@incubaunas/db';
import type {
  DomainRecord,
  DomainRepository,
  DomainState,
  HostRoute,
  HostRouteRepository,
  ServiceAccountRecord,
  ServiceAccountRepository,
  ServiceCredentialRecord,
} from '../../application/ports.js';

interface AccountRow {
  id: string;
  organization_id: string;
  name: string;
  auth_method: 'client_secret' | 'private_key_jwt';
  scopes: string[];
  audiences: string[];
  state: 'active' | 'revoked';
  expires_at: Date;
  revision: string | number;
  created_at: Date;
  updated_at: Date;
}

const toAccount = (row: AccountRow): ServiceAccountRecord => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  authMethod: row.auth_method,
  scopes: row.scopes,
  audiences: row.audiences,
  state: row.state,
  expiresAt: row.expires_at,
  revision: Number(row.revision),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class PgServiceAccountRepository implements ServiceAccountRepository {
  constructor(private readonly client: DbClient) {}

  async insert(a: ServiceAccountRecord, createdBy: Uuid | null): Promise<void> {
    try {
      await this.client.query(
        `insert into service_accounts (id, organization_id, name, auth_method, scopes, audiences, state, expires_at,
                                       revision, created_at, updated_at, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11)`,
        [
          a.id,
          a.organizationId,
          a.name,
          a.authMethod,
          a.scopes,
          a.audiences,
          a.state,
          a.expiresAt,
          a.revision,
          a.createdAt,
          createdBy,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error, 'service_accounts_organization_id_name_key')) {
        throw new AppError(
          'already_exists',
          409,
          'Ya existe una cuenta de servicio con ese nombre.',
        );
      }
      throw error;
    }
  }

  async findById(organizationId: Uuid, id: Uuid): Promise<ServiceAccountRecord | null> {
    const { rows } = await this.client.query<AccountRow>(
      'select * from service_accounts where organization_id = $1 and id = $2',
      [organizationId, id],
    );
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async insertCredential(c: ServiceCredentialRecord): Promise<void> {
    await this.client.query(
      `insert into service_credentials (id, service_account_id, organization_id, secret_hash, public_jwk, expires_at, created_at)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        c.id,
        c.serviceAccountId,
        c.organizationId,
        c.secretHash,
        c.publicJwk ? JSON.stringify(c.publicJwk) : null,
        c.expiresAt,
        c.createdAt,
      ],
    );
  }

  async shortenActiveCredentials(serviceAccountId: Uuid, until: Date, except: Uuid): Promise<void> {
    await this.client.query(
      `update service_credentials set expires_at = least(expires_at, $2)
        where service_account_id = $1 and id <> $3 and revoked_at is null`,
      [serviceAccountId, until, except],
    );
  }

  async revoke(organizationId: Uuid, id: Uuid, now: Date): Promise<ServiceAccountRecord | null> {
    const { rows } = await this.client.query<AccountRow>(
      `update service_accounts set state = 'revoked', updated_at = $3, revision = revision + 1
        where organization_id = $1 and id = $2 returning *`,
      [organizationId, id, now],
    );
    if (!rows[0]) return null;
    await this.client.query(
      'update service_credentials set revoked_at = $2 where service_account_id = $1 and revoked_at is null',
      [id, now],
    );
    return toAccount(rows[0]);
  }
}

interface DomainRow {
  id: string;
  organization_id: string;
  site_id: string;
  hostname: string;
  state: DomainState;
  is_primary: boolean;
  challenge_method: 'dns_txt' | 'http_file';
  challenge_name: string;
  challenge_value: string;
  activated_at: Date | null;
  revision: string | number;
  created_at: Date;
  updated_at: Date;
}

const toDomain = (row: DomainRow): DomainRecord => ({
  id: row.id,
  organizationId: row.organization_id,
  siteId: row.site_id,
  hostname: row.hostname,
  state: row.state,
  isPrimary: row.is_primary,
  challenge: { method: row.challenge_method, name: row.challenge_name, value: row.challenge_value },
  activatedAt: row.activated_at,
  revision: Number(row.revision),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class PgDomainRepository implements DomainRepository {
  constructor(private readonly client: DbClient) {}

  async insert(d: DomainRecord, createdBy: Uuid | null): Promise<void> {
    try {
      await this.client.query(
        `insert into domains (id, organization_id, site_id, hostname, state, is_primary, challenge_method, challenge_name,
                              challenge_value, revision, created_at, updated_at, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12)`,
        [
          d.id,
          d.organizationId,
          d.siteId,
          d.hostname,
          d.state,
          d.isPrimary,
          d.challenge.method,
          d.challenge.name,
          d.challenge.value,
          d.revision,
          d.createdAt,
          createdBy,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error, 'domains_hostname_key')) {
        throw new AppError('already_exists', 409, 'Ese dominio ya está registrado.', [
          {
            pointer: '/hostname',
            code: 'unique',
            message: 'El hostname pertenece a otra organización o sitio.',
          },
        ]);
      }
      throw error;
    }
  }

  async findById(organizationId: Uuid, id: Uuid): Promise<DomainRecord | null> {
    const { rows } = await this.client.query<DomainRow>(
      'select * from domains where organization_id = $1 and id = $2',
      [organizationId, id],
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async setState(
    domain: DomainRecord,
    expectedRevision: number,
    next: DomainState,
    now: Date,
  ): Promise<DomainRecord> {
    const { rows } = await this.client.query<DomainRow>(
      `update domains
          set state = $4, updated_at = $5, revision = revision + 1,
              activated_at = case when $4 = 'active' then $5 else activated_at end
        where organization_id = $1 and id = $2 and revision = $3
        returning *`,
      [domain.organizationId, domain.id, expectedRevision, next, now],
    );
    if (!rows[0]) throw staleRevision();
    return toDomain(rows[0]);
  }
}

export class PgHostRouteRepository implements HostRouteRepository {
  constructor(private readonly client: DbClient) {}

  async upsert(route: HostRoute, now: Date): Promise<void> {
    await this.client.query(
      `insert into host_routes (hostname, site_id, organization_id, updated_at) values ($1, $2, $3, $4)
       on conflict (hostname) do update set site_id = excluded.site_id, organization_id = excluded.organization_id,
                                            updated_at = excluded.updated_at`,
      [route.hostname, route.siteId, route.organizationId, now],
    );
  }

  async find(hostname: string): Promise<HostRoute | null> {
    const { rows } = await this.client.query<{
      hostname: string;
      site_id: string;
      organization_id: string;
    }>('select hostname, site_id, organization_id from host_routes where hostname = $1', [
      hostname,
    ]);
    const row = rows[0];
    return row
      ? { hostname: row.hostname, siteId: row.site_id, organizationId: row.organization_id }
      : null;
  }
}
