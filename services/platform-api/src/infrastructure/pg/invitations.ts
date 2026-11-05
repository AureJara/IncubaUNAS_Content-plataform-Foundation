import { AppError, staleRevision, type Uuid } from '@incubaunas/shared-kernel';
import { isUniqueViolation, type DbClient } from '@incubaunas/db';
import type { Role } from '@incubaunas/tenancy';
import { Invitation, type InvitationState } from '../../domain/invitation.js';
import type { InvitationRepository } from '../../application/ports.js';

interface InvitationRow {
  id: string;
  organization_id: string;
  email_ciphertext: string;
  email_blind_index: string;
  roles: string[];
  token_hash: string;
  state: string;
  expires_at: Date;
  accepted_by: string | null;
  revision: string | number;
  created_at: Date;
  updated_at: Date;
}

const toInvitation = (row: InvitationRow): Invitation =>
  Invitation.restore({
    id: row.id,
    organizationId: row.organization_id,
    emailCiphertext: row.email_ciphertext,
    emailBlindIndex: row.email_blind_index,
    roles: row.roles as Role[],
    tokenHash: row.token_hash,
    state: row.state as InvitationState,
    expiresAt: row.expires_at,
    acceptedBy: row.accepted_by,
    revision: Number(row.revision),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export class PgInvitationRepository implements InvitationRepository {
  constructor(private readonly client: DbClient) {}

  async insert(invitation: Invitation, actorUserId: Uuid | null): Promise<void> {
    const s = invitation.snapshot;
    try {
      await this.client.query(
        `insert into invitations (id, organization_id, email_ciphertext, email_blind_index, roles, token_hash, state,
                                  expires_at, revision, created_at, updated_at, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11)`,
        [
          s.id,
          s.organizationId,
          s.emailCiphertext,
          s.emailBlindIndex,
          s.roles,
          s.tokenHash,
          s.state,
          s.expiresAt,
          s.revision,
          s.createdAt,
          actorUserId,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error, 'invitations_one_pending_idx')) {
        throw new AppError(
          'already_exists',
          409,
          'Ya hay una invitación pendiente para ese correo.',
        );
      }
      throw error;
    }
  }

  async findByTokenHash(organizationId: Uuid, tokenHash: string): Promise<Invitation | null> {
    const { rows } = await this.client.query<InvitationRow>(
      'select * from invitations where organization_id = $1 and token_hash = $2',
      [organizationId, tokenHash],
    );
    return rows[0] ? toInvitation(rows[0]) : null;
  }

  async update(invitation: Invitation, expectedRevision: number): Promise<Invitation> {
    const s = invitation.snapshot;
    const { rows } = await this.client.query<InvitationRow>(
      `update invitations set state = $3, accepted_by = $4, updated_at = $5, revision = revision + 1
        where id = $1 and organization_id = $2 and revision = $6
        returning *`,
      [s.id, s.organizationId, s.state, s.acceptedBy, s.updatedAt, expectedRevision],
    );
    if (!rows[0]) throw staleRevision();
    return toInvitation(rows[0]);
  }
}
