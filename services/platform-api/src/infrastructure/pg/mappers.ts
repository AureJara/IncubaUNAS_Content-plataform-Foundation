import type { Restriction, Role } from '@incubaunas/tenancy';
import type { MembershipSnapshot, MembershipState } from '../../domain/membership.js';
import type { OrganizationSnapshot, OrganizationState } from '../../domain/organization.js';
import type { SessionRecord } from '../../application/ports.js';

/** Filas de PostgreSQL → objetos del dominio. `bigint` llega como string desde el driver. */

export interface OrganizationRow {
  id: string;
  slug: string;
  legal_name: string | null;
  display_name: string;
  timezone: string;
  locale: string;
  state: string;
  revision: string | number;
  created_at: Date;
  updated_at: Date;
}

export const toOrganizationSnapshot = (row: OrganizationRow): OrganizationSnapshot => ({
  id: row.id,
  slug: row.slug,
  legalName: row.legal_name,
  displayName: row.display_name,
  timezone: row.timezone,
  locale: row.locale,
  state: row.state as OrganizationState,
  revision: Number(row.revision),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export interface MembershipRow {
  id: string;
  organization_id: string;
  user_id: string;
  state: string;
  restrictions: { type: Restriction['type']; id: string; validUntil: string | null }[];
  roles: string[];
  revision: string | number;
  created_at: Date;
  updated_at: Date;
}

export const toMembershipSnapshot = (row: MembershipRow): MembershipSnapshot => ({
  id: row.id,
  organizationId: row.organization_id,
  userId: row.user_id,
  state: row.state as MembershipState,
  roles: row.roles as Role[],
  restrictions: row.restrictions.map((r) => ({
    type: r.type,
    id: r.id,
    validUntil: r.validUntil ? new Date(r.validUntil) : null,
  })),
  revision: Number(row.revision),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const restrictionsToJson = (restrictions: readonly Restriction[]): string =>
  JSON.stringify(
    restrictions.map((r) => ({
      type: r.type,
      id: r.id,
      validUntil: r.validUntil?.toISOString() ?? null,
    })),
  );

export interface SessionRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  secret_hash: string;
  previous_secret_hash: string | null;
  device_label: string | null;
  ip_pseudonym: string | null;
  auth_time: Date;
  amr: string[];
  created_at: Date;
  last_used_at: Date;
  idle_expires_at: Date;
  absolute_expires_at: Date;
  revoked_at: Date | null;
}

export const toSessionRecord = (row: SessionRow): SessionRecord => ({
  id: row.id,
  userId: row.user_id,
  organizationId: row.organization_id,
  secretHash: row.secret_hash,
  previousSecretHash: row.previous_secret_hash,
  deviceLabel: row.device_label,
  ipPseudonym: row.ip_pseudonym,
  authTime: row.auth_time,
  amr: row.amr,
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
  idleExpiresAt: row.idle_expires_at,
  absoluteExpiresAt: row.absolute_expires_at,
  revokedAt: row.revoked_at,
});
