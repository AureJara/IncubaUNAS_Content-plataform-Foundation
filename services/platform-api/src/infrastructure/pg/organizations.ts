import { AppError, staleRevision, type Uuid } from '@incubaunas/shared-kernel';
import { isUniqueViolation, type DbClient } from '@incubaunas/db';
import { Organization } from '../../domain/organization.js';
import type { OrganizationRepository } from '../../application/ports.js';
import { toOrganizationSnapshot, type OrganizationRow } from './mappers.js';

export class PgOrganizationRepository implements OrganizationRepository {
  constructor(private readonly client: DbClient) {}

  async insert(organization: Organization, actorUserId: Uuid | null): Promise<void> {
    const s = organization.snapshot;
    try {
      await this.client.query(
        `insert into organizations (id, slug, legal_name, display_name, timezone, locale, state, revision,
                                    created_at, updated_at, created_by, updated_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
        [
          s.id,
          s.slug,
          s.legalName,
          s.displayName,
          s.timezone,
          s.locale,
          s.state,
          s.revision,
          s.createdAt,
          s.updatedAt,
          actorUserId,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error, 'organizations_slug_key')) {
        throw new AppError('already_exists', 409, 'El slug ya está en uso.', [
          { pointer: '/slug', code: 'unique', message: 'Elige otro slug.' },
        ]);
      }
      throw error;
    }
  }

  async findById(id: Uuid): Promise<Organization | null> {
    const { rows } = await this.client.query<OrganizationRow>(
      'select * from organizations where id = $1',
      [id],
    );
    return rows[0] ? Organization.restore(toOrganizationSnapshot(rows[0])) : null;
  }

  async update(
    organization: Organization,
    expectedRevision: number,
    actorUserId: Uuid | null,
  ): Promise<Organization> {
    const s = organization.snapshot;
    const { rows } = await this.client.query<OrganizationRow>(
      `update organizations
          set legal_name = $3, display_name = $4, timezone = $5, locale = $6, state = $7,
              updated_at = $8, updated_by = $9, revision = revision + 1
        where id = $1 and revision = $2
        returning *`,
      [
        s.id,
        expectedRevision,
        s.legalName,
        s.displayName,
        s.timezone,
        s.locale,
        s.state,
        s.updatedAt,
        actorUserId,
      ],
    );
    if (!rows[0]) throw staleRevision();
    return Organization.restore(toOrganizationSnapshot(rows[0]));
  }
}
