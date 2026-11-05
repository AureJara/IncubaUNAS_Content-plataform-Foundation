import type { Uuid } from '@incubaunas/shared-kernel';
import type { DbClient } from '@incubaunas/db';
import type {
  LoginAttempt,
  LoginAttemptRepository,
  SessionRecord,
  SessionRepository,
} from '../../application/ports.js';
import { toSessionRecord, type SessionRow } from './mappers.js';

export class PgSessionRepository implements SessionRepository {
  constructor(private readonly client: DbClient) {}

  async insert(s: SessionRecord): Promise<void> {
    await this.client.query(
      `insert into sessions (id, user_id, organization_id, secret_hash, previous_secret_hash, device_label, ip_pseudonym,
                             auth_time, amr, created_at, last_used_at, idle_expires_at, absolute_expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        s.id,
        s.userId,
        s.organizationId,
        s.secretHash,
        s.previousSecretHash,
        s.deviceLabel,
        s.ipPseudonym,
        s.authTime,
        s.amr,
        s.createdAt,
        s.lastUsedAt,
        s.idleExpiresAt,
        s.absoluteExpiresAt,
      ],
    );
  }

  async findById(id: Uuid): Promise<SessionRecord | null> {
    const { rows } = await this.client.query<SessionRow>('select * from sessions where id = $1', [
      id,
    ]);
    return rows[0] ? toSessionRecord(rows[0]) : null;
  }

  async touch(id: Uuid, lastUsedAt: Date, idleExpiresAt: Date): Promise<void> {
    await this.client.query(
      'update sessions set last_used_at = $2, idle_expires_at = $3 where id = $1 and revoked_at is null',
      [id, lastUsedAt, idleExpiresAt],
    );
  }

  async rotate(
    id: Uuid,
    newSecretHash: string,
    previousSecretHash: string,
    now: Date,
    idleExpiresAt: Date,
  ): Promise<void> {
    await this.client.query(
      `update sessions set secret_hash = $2, previous_secret_hash = $3, last_used_at = $4, idle_expires_at = $5
        where id = $1 and revoked_at is null`,
      [id, newSecretHash, previousSecretHash, now, idleExpiresAt],
    );
  }

  async setOrganization(
    id: Uuid,
    organizationId: Uuid | null,
    newSecretHash: string,
    previousSecretHash: string,
  ): Promise<void> {
    await this.client.query(
      `update sessions set organization_id = $2, secret_hash = $3, previous_secret_hash = $4
        where id = $1 and revoked_at is null`,
      [id, organizationId, newSecretHash, previousSecretHash],
    );
  }

  async revoke(id: Uuid, now: Date, reason: string): Promise<void> {
    await this.client.query(
      'update sessions set revoked_at = $2, revoked_reason = $3 where id = $1 and revoked_at is null',
      [id, now, reason],
    );
  }

  async revokeAllForUser(userId: Uuid, now: Date, reason: string): Promise<number> {
    const result = await this.client.query(
      'update sessions set revoked_at = $2, revoked_reason = $3 where user_id = $1 and revoked_at is null',
      [userId, now, reason],
    );
    return result.rowCount ?? 0;
  }

  async revokeForUserInOrganization(
    userId: Uuid,
    organizationId: Uuid,
    now: Date,
    reason: string,
  ): Promise<number> {
    const result = await this.client.query(
      `update sessions set revoked_at = $3, revoked_reason = $4
        where user_id = $1 and organization_id = $2 and revoked_at is null`,
      [userId, organizationId, now, reason],
    );
    return result.rowCount ?? 0;
  }

  async revokeAllInOrganization(organizationId: Uuid, now: Date, reason: string): Promise<number> {
    const result = await this.client.query(
      'update sessions set revoked_at = $2, revoked_reason = $3 where organization_id = $1 and revoked_at is null',
      [organizationId, now, reason],
    );
    return result.rowCount ?? 0;
  }

  async listActiveForUser(userId: Uuid, now: Date): Promise<SessionRecord[]> {
    const { rows } = await this.client.query<SessionRow>(
      `select * from sessions
        where user_id = $1 and revoked_at is null and idle_expires_at > $2 and absolute_expires_at > $2
        order by last_used_at desc`,
      [userId, now],
    );
    return rows.map(toSessionRecord);
  }
}

interface AttemptRow {
  id: string;
  attempt_hash: string;
  state: string;
  nonce: string;
  code_verifier_ciphertext: string;
  return_to: string;
  created_at: Date;
  expires_at: Date;
}

export class PgLoginAttemptRepository implements LoginAttemptRepository {
  constructor(private readonly client: DbClient) {}

  async insert(a: LoginAttempt): Promise<void> {
    await this.client.query(
      `insert into login_attempts (id, attempt_hash, state, nonce, code_verifier_ciphertext, return_to, created_at, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        a.id,
        a.attemptHash,
        a.state,
        a.nonce,
        a.codeVerifierCiphertext,
        a.returnTo,
        a.createdAt,
        a.expiresAt,
      ],
    );
  }

  async consume(attemptHash: string, now: Date): Promise<LoginAttempt | null> {
    const { rows } = await this.client.query<AttemptRow>(
      'delete from login_attempts where attempt_hash = $1 returning *',
      [attemptHash],
    );
    const row = rows[0];
    if (!row || row.expires_at.getTime() <= now.getTime()) return null;
    return {
      id: row.id,
      attemptHash: row.attempt_hash,
      state: row.state,
      nonce: row.nonce,
      codeVerifierCiphertext: row.code_verifier_ciphertext,
      returnTo: row.return_to,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }
}
