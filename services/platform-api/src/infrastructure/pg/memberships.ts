import { staleRevision, type Uuid } from '@incubaunas/shared-kernel';
import type { DbClient } from '@incubaunas/db';
import type { Role } from '@incubaunas/tenancy';
import { Membership, type MembershipState } from '../../domain/membership.js';
import type {
  Keyset,
  MemberView,
  MembershipRepository,
  OrganizationMembershipView,
} from '../../application/ports.js';
import {
  restrictionsToJson,
  toMembershipSnapshot,
  toOrganizationSnapshot,
  type MembershipRow,
  type OrganizationRow,
} from './mappers.js';

const SELECT_WITH_ROLES = `
  select m.*, coalesce(array_agg(r.role order by r.role) filter (where r.role is not null), '{}') as roles
    from memberships m
    left join membership_roles r on r.membership_id = m.id`;

export class PgMembershipRepository implements MembershipRepository {
  constructor(private readonly client: DbClient) {}

  async insert(membership: Membership, actorUserId: Uuid | null): Promise<void> {
    const s = membership.snapshot;
    await this.client.query(
      `insert into memberships (id, organization_id, user_id, state, restrictions, revision, created_at, updated_at, created_by, updated_by)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $9)`,
      [
        s.id,
        s.organizationId,
        s.userId,
        s.state,
        restrictionsToJson(s.restrictions),
        s.revision,
        s.createdAt,
        s.updatedAt,
        actorUserId,
      ],
    );
    await this.writeRoles(s.id, s.organizationId, s.roles);
  }

  async findById(organizationId: Uuid, id: Uuid): Promise<Membership | null> {
    const { rows } = await this.client.query<MembershipRow>(
      `${SELECT_WITH_ROLES} where m.id = $1 and m.organization_id = $2 group by m.id`,
      [id, organizationId],
    );
    return rows[0] ? Membership.restore(toMembershipSnapshot(rows[0])) : null;
  }

  async findCurrentForUser(organizationId: Uuid, userId: Uuid): Promise<Membership | null> {
    const { rows } = await this.client.query<MembershipRow>(
      `${SELECT_WITH_ROLES}
        where m.organization_id = $1 and m.user_id = $2 and m.state in ('invited', 'active', 'suspended')
        group by m.id`,
      [organizationId, userId],
    );
    return rows[0] ? Membership.restore(toMembershipSnapshot(rows[0])) : null;
  }

  async update(
    membership: Membership,
    expectedRevision: number,
    actorUserId: Uuid | null,
  ): Promise<Membership> {
    const s = membership.snapshot;
    const { rowCount } = await this.client.query(
      `update memberships
          set state = $3, restrictions = $4::jsonb, updated_at = $5, updated_by = $6, revision = revision + 1
        where id = $1 and organization_id = $2 and revision = $7`,
      [
        s.id,
        s.organizationId,
        s.state,
        restrictionsToJson(s.restrictions),
        s.updatedAt,
        actorUserId,
        expectedRevision,
      ],
    );
    if (!rowCount) throw staleRevision();

    await this.client.query('delete from membership_roles where membership_id = $1', [s.id]);
    await this.writeRoles(s.id, s.organizationId, s.roles);

    const updated = await this.findById(s.organizationId, s.id);
    return updated!;
  }

  async list(
    organizationId: Uuid,
    filter: { state?: MembershipState; role?: Role },
    limit: number,
    after: Keyset | null,
  ): Promise<MemberView[]> {
    const params: unknown[] = [organizationId];
    const where = ['m.organization_id = $1'];
    if (filter.state) where.push(`m.state = $${params.push(filter.state)}`);
    if (filter.role) {
      where.push(
        `exists (select 1 from membership_roles fr where fr.membership_id = m.id and fr.role = $${params.push(filter.role)})`,
      );
    }
    if (after) {
      const createdAt = params.push(after.createdAt);
      const id = params.push(after.id);
      where.push(`(m.created_at, m.id) > ($${createdAt}::timestamptz, $${id}::uuid)`);
    }
    params.push(limit);

    const { rows } = await this.client.query<
      MembershipRow & { display_name: string | null; email_ciphertext: string | null }
    >(
      `select m.*, u.display_name, u.email_ciphertext,
              coalesce(array_agg(r.role order by r.role) filter (where r.role is not null), '{}') as roles
         from memberships m
         join users u on u.id = m.user_id
         left join membership_roles r on r.membership_id = m.id
        where ${where.join(' and ')}
        group by m.id, u.id
        order by m.created_at, m.id
        limit $${params.length}`,
      params,
    );
    return rows.map((row) => ({
      membership: toMembershipSnapshot(row),
      displayName: row.display_name,
      emailCiphertext: row.email_ciphertext,
    }));
  }

  async countActiveOwners(organizationId: Uuid): Promise<number> {
    const { rows } = await this.client.query<{ n: number }>(
      `select count(*)::int as n
         from memberships m join membership_roles r on r.membership_id = m.id
        where m.organization_id = $1 and m.state = 'active' and r.role = 'org_owner'`,
      [organizationId],
    );
    return rows[0]?.n ?? 0;
  }

  async listActiveForUser(userId: Uuid): Promise<OrganizationMembershipView[]> {
    const { rows } = await this.client.query<OrganizationRow & { roles: string[] }>(
      `select o.*, coalesce(array_agg(r.role order by r.role) filter (where r.role is not null), '{}') as roles
         from memberships m
         join organizations o on o.id = m.organization_id
         left join membership_roles r on r.membership_id = m.id
        where m.user_id = $1 and m.state = 'active' and o.state = 'active'
        group by o.id
        order by o.display_name, o.id`,
      [userId],
    );
    return rows.map((row) => ({
      organization: toOrganizationSnapshot(row),
      roles: row.roles as Role[],
    }));
  }

  private async writeRoles(
    membershipId: Uuid,
    organizationId: Uuid,
    roles: readonly Role[],
  ): Promise<void> {
    await this.client.query(
      `insert into membership_roles (membership_id, organization_id, role)
       select $1, $2, unnest($3::text[])`,
      [membershipId, organizationId, roles],
    );
  }
}
