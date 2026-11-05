import type { Uuid } from '@incubaunas/shared-kernel';
import type { DbClient } from '@incubaunas/db';
import type { NewUser, UserRecord, UserRepository } from '../../application/ports.js';

interface UserRow {
  id: string;
  display_name: string | null;
  email_ciphertext: string | null;
  email_blind_index: string | null;
}

const toRecord = (row: UserRow): UserRecord => ({
  id: row.id,
  displayName: row.display_name,
  emailCiphertext: row.email_ciphertext,
  emailBlindIndex: row.email_blind_index,
});

export class PgUserRepository implements UserRepository {
  constructor(private readonly client: DbClient) {}

  async findByIdentity(issuer: string, subject: string): Promise<UserRecord | null> {
    const { rows } = await this.client.query<UserRow>(
      `select u.* from users u join identities i on i.user_id = u.id where i.issuer = $1 and i.subject = $2`,
      [issuer, subject],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findById(id: Uuid): Promise<UserRecord | null> {
    const { rows } = await this.client.query<UserRow>('select * from users where id = $1', [id]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findByEmailBlindIndex(blindIndex: string): Promise<UserRecord | null> {
    const { rows } = await this.client.query<UserRow>(
      'select * from users where email_blind_index = $1 order by created_at limit 1',
      [blindIndex],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async insert(user: NewUser, now: Date): Promise<void> {
    await this.client.query(
      `insert into users (id, display_name, email_ciphertext, email_blind_index, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $5)`,
      [user.id, user.displayName, user.emailCiphertext, user.emailBlindIndex, now],
    );
    await this.client.query(
      `insert into identities (id, user_id, issuer, subject, created_at) values (gen_random_uuid(), $1, $2, $3, $4)`,
      [user.id, user.issuer, user.subject, now],
    );
  }

  async updateProfile(id: Uuid, profile: Omit<UserRecord, 'id'>, now: Date): Promise<void> {
    await this.client.query(
      `update users set display_name = $2, email_ciphertext = $3, email_blind_index = $4, updated_at = $5 where id = $1`,
      [id, profile.displayName, profile.emailCiphertext, profile.emailBlindIndex, now],
    );
  }
}
