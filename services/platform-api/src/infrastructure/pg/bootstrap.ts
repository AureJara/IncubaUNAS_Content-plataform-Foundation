import type { Uuid } from '@incubaunas/shared-kernel';
import type { DbClient } from '@incubaunas/db';
import type { BootstrapStore, StoredResponse } from '../../application/ports.js';

const lockKey = (parts: string[]): string => parts.join('|');

export class PgBootstrapStore implements BootstrapStore {
  constructor(private readonly client: DbClient) {}

  async find(
    actorId: string,
    key: string,
  ): Promise<(StoredResponse & { organizationId: Uuid }) | null> {
    await this.client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [
      lockKey(['bootstrap', actorId, key]),
    ]);
    const { rows } = await this.client.query<{
      request_hash: string;
      response: unknown;
      organization_id: string;
    }>(
      'select request_hash, response, organization_id from bootstrap_requests where actor_id = $1 and key = $2',
      [actorId, key],
    );
    const row = rows[0];
    return row
      ? {
          requestHash: row.request_hash,
          response: row.response,
          organizationId: row.organization_id,
        }
      : null;
  }

  async save(
    actorId: string,
    key: string,
    organizationId: Uuid,
    stored: StoredResponse,
    now: Date,
  ): Promise<void> {
    await this.client.query(
      `insert into bootstrap_requests (actor_id, key, request_hash, organization_id, response, created_at)
       values ($1, $2, $3, $4, $5::jsonb, $6)`,
      [actorId, key, stored.requestHash, organizationId, JSON.stringify(stored.response), now],
    );
  }
}
