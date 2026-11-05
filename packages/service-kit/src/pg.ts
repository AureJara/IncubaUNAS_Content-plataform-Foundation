import type { DbClient } from '@incubaunas/db';
import type { Uuid } from '@incubaunas/shared-kernel';
import type {
  AuditEntry,
  AuditLog,
  AuditRow,
  IdempotencyScope,
  IdempotencyStore,
  StoredResponse,
} from './index.js';

/** Adaptadores PostgreSQL de las tablas `security_audit` e `idempotency_keys` (mismo DDL en cada servicio). */
export class PgAuditLog implements AuditLog {
  constructor(private readonly client: DbClient) {}

  async record(entry: AuditEntry, id: Uuid, now: Date): Promise<void> {
    await this.client.query(
      `insert into security_audit (id, organization_id, occurred_at, actor_type, actor_id, action, target_type, target_id,
                                   outcome, request_id, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
      [
        id,
        entry.organizationId,
        now,
        entry.actor.type,
        entry.actor.id,
        entry.action,
        entry.target.type,
        entry.target.id,
        entry.outcome,
        entry.requestId,
        JSON.stringify(entry.metadata ?? {}),
      ],
    );
  }

  async list(
    organizationId: Uuid,
    filter: { action?: string; from?: Date; to?: Date },
    limit: number,
    after: { occurredAt: string; id: string } | null,
  ): Promise<AuditRow[]> {
    const params: unknown[] = [organizationId];
    const where = ['organization_id = $1'];
    if (filter.action) where.push(`action = $${params.push(filter.action)}`);
    if (filter.from) where.push(`occurred_at >= $${params.push(filter.from)}`);
    if (filter.to) where.push(`occurred_at <= $${params.push(filter.to)}`);
    if (after) {
      const at = params.push(after.occurredAt);
      const id = params.push(after.id);
      where.push(`(occurred_at, id) < ($${at}::timestamptz, $${id}::uuid)`);
    }
    params.push(limit);

    const { rows } = await this.client.query(
      `select * from security_audit where ${where.join(' and ')} order by occurred_at desc, id desc limit $${params.length}`,
      params,
    );
    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      occurredAt: row.occurred_at,
      actor: { type: row.actor_type, id: row.actor_id },
      action: row.action,
      target: { type: row.target_type, id: row.target_id },
      outcome: row.outcome,
      requestId: row.request_id,
      metadata: row.metadata,
    }));
  }
}

export class PgIdempotencyStore implements IdempotencyStore {
  constructor(private readonly client: DbClient) {}

  async find(scope: IdempotencyScope, key: string): Promise<StoredResponse | null> {
    // Serializa peticiones simultáneas con la misma clave: la segunda espera y luego reproduce.
    await this.client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [
      [scope.organizationId, scope.actorId, scope.operation, key].join('|'),
    ]);
    const { rows } = await this.client.query<{ request_hash: string; response: unknown }>(
      `select request_hash, response from idempotency_keys
        where organization_id = $1 and actor_id = $2 and operation = $3 and key = $4 and expires_at > now()`,
      [scope.organizationId, scope.actorId, scope.operation, key],
    );
    return rows[0] ? { requestHash: rows[0].request_hash, response: rows[0].response } : null;
  }

  async save(
    scope: IdempotencyScope,
    key: string,
    stored: StoredResponse,
    now: Date,
    expiresAt: Date,
  ): Promise<void> {
    await this.client.query(
      `insert into idempotency_keys (organization_id, actor_id, operation, key, request_hash, response, created_at, expires_at)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       on conflict (organization_id, actor_id, operation, key)
       do update set request_hash = excluded.request_hash, response = excluded.response,
                     created_at = excluded.created_at, expires_at = excluded.expires_at`,
      [
        scope.organizationId,
        scope.actorId,
        scope.operation,
        key,
        stored.requestHash,
        JSON.stringify(stored.response),
        now,
        expiresAt,
      ],
    );
  }
}
