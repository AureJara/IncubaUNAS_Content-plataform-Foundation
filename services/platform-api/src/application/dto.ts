import type { Restriction, Role } from '@incubaunas/tenancy';
import type { InvitationSnapshot } from '../domain/invitation.js';
import type { OrganizationSnapshot } from '../domain/organization.js';
import type { MemberView } from './ports.js';

/** Representaciones de la API (snake_case, tal como las declara el OpenAPI). */

export interface OrganizationDto {
  id: string;
  organization_id: string;
  slug: string;
  legal_name: string | null;
  display_name: string;
  timezone: string;
  locale: string;
  state: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

export const toOrganizationDto = (o: OrganizationSnapshot): OrganizationDto => ({
  id: o.id,
  organization_id: o.id,
  slug: o.slug,
  legal_name: o.legalName,
  display_name: o.displayName,
  timezone: o.timezone,
  locale: o.locale,
  state: o.state,
  revision: o.revision,
  created_at: o.createdAt.toISOString(),
  updated_at: o.updatedAt.toISOString(),
});

export interface RestrictionDto {
  resource_type: string;
  resource_id: string;
  valid_until?: string;
}

export const toRestrictionDto = (r: Restriction): RestrictionDto => ({
  resource_type: r.type,
  resource_id: r.id,
  ...(r.validUntil ? { valid_until: r.validUntil.toISOString() } : {}),
});

export interface MembershipDto {
  id: string;
  organization_id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  state: string;
  roles: Role[];
  restrictions: RestrictionDto[];
  revision: number;
  created_at: string;
  updated_at: string;
}

export const toMembershipDto = (view: MemberView, email: string | null): MembershipDto => ({
  id: view.membership.id,
  organization_id: view.membership.organizationId,
  user_id: view.membership.userId,
  email,
  display_name: view.displayName,
  state: view.membership.state,
  roles: view.membership.roles,
  restrictions: view.membership.restrictions.map(toRestrictionDto),
  revision: view.membership.revision,
  created_at: view.membership.createdAt.toISOString(),
  updated_at: view.membership.updatedAt.toISOString(),
});

export interface InvitationDto {
  id: string;
  organization_id: string;
  email_masked: string;
  roles: Role[];
  state: string;
  expires_at: string;
  created_at: string;
}

/** `a***@example.org`: suficiente para reconocer la invitación sin exponer el correo. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

export const toInvitationDto = (i: InvitationSnapshot, emailMasked: string): InvitationDto => ({
  id: i.id,
  organization_id: i.organizationId,
  email_masked: emailMasked,
  roles: i.roles,
  state: i.state,
  expires_at: i.expiresAt.toISOString(),
  created_at: i.createdAt.toISOString(),
});
