import type { FastifyReply, FastifyRequest } from 'fastify';
import { contextOf, sendPublicCacheable, type OperationHandler } from '@incubaunas/http-kit';
import { etagFor, hmacHex, parseIfMatch, type Uuid } from '@incubaunas/shared-kernel';
import { Authorization, type RequestContext, type ResourceType } from '@incubaunas/tenancy';
import type { DomainService } from '../../application/domains.js';
import type { InvitationService } from '../../application/invitations.js';
import type { MeService } from '../../application/me.js';
import type { MembershipService } from '../../application/memberships.js';
import type { OrganizationService } from '../../application/organizations.js';
import type { ServiceAccountService } from '../../application/service-accounts.js';
import type { SessionService } from '../../application/sessions.js';
import type { SessionCookies } from './cookies.js';

export interface HandlerDependencies {
  organizations: OrganizationService;
  memberships: MembershipService;
  invitations: InvitationService;
  me: MeService;
  sessions: SessionService;
  serviceAccounts: ServiceAccountService;
  domains: DomainService;
  cookies: SessionCookies;
  /** URL exacta registrada en el proveedor de identidad. */
  oidcRedirectUri: string;
  /** Clave para seudonimizar la IP en la lista de sesiones. */
  ipPseudonymKey: string;
}

type Source = 'params' | 'query' | 'body' | 'headers';
const read = <T>(request: FastifyRequest, source: Source): T => request[source] as T;
const idempotencyKey = (request: FastifyRequest): string =>
  String(request.headers['idempotency-key']);
const noStore = (reply: FastifyReply) => reply.header('cache-control', 'no-store');

/** Contexto de una operación pública: sin credenciales, sin permisos. */
const anonymous = (request: FastifyRequest): RequestContext => ({
  requestId: request.id,
  organizationId: null,
  actor: { type: 'system', id: 'system:public' },
  authz: new Authorization({ authTime: new Date() }),
});

/**
 * Adaptadores HTTP → casos de uso. Solo traducen: leen la petición ya validada por el contrato,
 * llaman al caso de uso y dan forma a la respuesta (códigos, ETag, cookies, caché).
 */
export function createHandlers(d: HandlerDependencies): Record<string, OperationHandler> {
  const { cookies } = d;

  return {
    // ------------------------------------------------------------ auth BFF
    async startLogin(request, reply) {
      const { return_to } = read<{ return_to?: string }>(request, 'query');
      const login = await d.sessions.beginLogin(return_to);
      cookies.setLoginAttempt(reply, login.attemptToken, login.maxAgeSeconds);
      return noStore(reply).redirect(login.redirectUrl, 302);
    },

    async completeLogin(request, reply) {
      // El callback se reconstruye sobre la URL registrada: no se confía en el Host de la petición.
      const callbackUrl = new URL(d.oidcRedirectUri);
      callbackUrl.search = new URL(request.url, 'http://localhost').search;

      const issued = await d.sessions.completeLogin({
        attemptToken: request.cookies[cookies.names.loginAttempt],
        callbackUrl,
        requestId: request.id,
        deviceLabel: String(request.headers['user-agent'] ?? '').slice(0, 120) || null,
        ipPseudonym: hmacHex(d.ipPseudonymKey, request.ip).slice(0, 16),
      });
      cookies.clearLoginAttempt(reply);
      cookies.setSession(reply, issued);
      return noStore(reply).redirect(issued.returnTo, 302);
    },

    async refreshSession(request, reply) {
      const issued = await d.sessions.refresh(request.cookies[cookies.names.session], request.id);
      cookies.setSession(reply, issued);
      return noStore(reply).status(204).send();
    },

    async logout(request, reply) {
      const ctx = contextOf(request);
      if (ctx.sessionId) await d.sessions.logout(ctx.sessionId, request.id);
      cookies.clearSession(reply);
      return noStore(reply).status(204).send();
    },

    async logoutAll(request, reply) {
      await d.sessions.logoutAll(contextOf(request));
      cookies.clearSession(reply);
      return noStore(reply).status(204).send();
    },

    // ------------------------------------------------------------ me
    async getMe(request, reply) {
      noStore(reply);
      return d.me.getMe(contextOf(request));
    },

    async getMyCapabilities(request, reply) {
      const { resource_type, resource_id } = read<{
        resource_type?: ResourceType;
        resource_id?: string;
      }>(request, 'query');
      noStore(reply);
      return d.me.capabilities(
        contextOf(request),
        resource_type && resource_id ? { type: resource_type, id: resource_id } : undefined,
      );
    },

    async listMyOrganizations(request) {
      return d.me.listMyOrganizations(contextOf(request));
    },

    async switchOrganizationContext(request, reply) {
      const { organization_id } = read<{ organization_id: Uuid }>(request, 'body');
      const issued = await d.sessions.switchOrganization(
        contextOf(request),
        request.cookies[cookies.names.session],
        organization_id,
      );
      cookies.setSession(reply, issued);
      return reply.status(204).send();
    },

    async listMySessions(request, reply) {
      const ctx = contextOf(request);
      const sessions = await d.sessions.listSessions(ctx);
      noStore(reply);
      return {
        items: sessions.map((s) => ({
          id: s.id,
          current: s.id === ctx.sessionId,
          device_label: s.deviceLabel,
          ip_pseudonym: s.ipPseudonym,
          created_at: s.createdAt.toISOString(),
          last_used_at: s.lastUsedAt.toISOString(),
          expires_at: new Date(
            Math.min(s.idleExpiresAt.getTime(), s.absoluteExpiresAt.getTime()),
          ).toISOString(),
        })),
        next_cursor: null,
      };
    },

    async revokeSession(request, reply) {
      const { session_id } = read<{ session_id: Uuid }>(request, 'params');
      await d.sessions.revokeSession(contextOf(request), session_id);
      return reply.status(204).send();
    },

    // ------------------------------------------------------------ organizaciones
    async createOrganization(request, reply) {
      const { value } = await d.organizations.create(
        contextOf(request),
        read(request, 'body'),
        idempotencyKey(request),
      );
      return reply
        .status(201)
        .header('etag', etagFor(value.revision))
        .header('location', `/platform/v1/organizations/${value.id}`)
        .send(value);
    },

    async getOrganization(request, reply) {
      const { organization_id } = read<{ organization_id: Uuid }>(request, 'params');
      const organization = await d.organizations.get(contextOf(request), organization_id);
      return reply.header('etag', etagFor(organization.revision)).send(organization);
    },

    async updateOrganization(request, reply) {
      const { organization_id } = read<{ organization_id: Uuid }>(request, 'params');
      const organization = await d.organizations.update(
        contextOf(request),
        organization_id,
        read(request, 'body'),
        parseIfMatch(request.headers['if-match']),
      );
      return reply.header('etag', etagFor(organization.revision)).send(organization);
    },

    async suspendOrganization(request) {
      const { organization_id } = read<{ organization_id: Uuid }>(request, 'params');
      const { reason } = read<{ reason: string }>(request, 'body');
      return d.organizations.suspend(
        contextOf(request),
        organization_id,
        reason,
        idempotencyKey(request),
      );
    },

    async reactivateOrganization(request) {
      const { organization_id } = read<{ organization_id: Uuid }>(request, 'params');
      const { reason } = read<{ reason: string }>(request, 'body');
      return d.organizations.reactivate(
        contextOf(request),
        organization_id,
        reason,
        idempotencyKey(request),
      );
    },

    async archiveOrganization(request) {
      const { organization_id } = read<{ organization_id: Uuid }>(request, 'params');
      const { reason } = read<{ reason: string }>(request, 'body');
      return d.organizations.archive(
        contextOf(request),
        organization_id,
        reason,
        idempotencyKey(request),
      );
    },

    // ------------------------------------------------------------ membresías e invitaciones
    async listMemberships(request) {
      const { organization_id } = read<{ organization_id: Uuid }>(request, 'params');
      return d.memberships.list(contextOf(request), organization_id, read(request, 'query'));
    },

    async createInvitation(request, reply) {
      const { organization_id } = read<{ organization_id: Uuid }>(request, 'params');
      const { value } = await d.invitations.create(
        contextOf(request),
        organization_id,
        read(request, 'body'),
        idempotencyKey(request),
      );
      return reply.status(201).send(value);
    },

    async acceptInvitation(request) {
      const { token } = read<{ token: string }>(request, 'params');
      return d.invitations.accept(contextOf(request), token, idempotencyKey(request));
    },

    async declineInvitation(request, reply) {
      const { token } = read<{ token: string }>(request, 'params');
      await d.invitations.decline(anonymous(request), token, idempotencyKey(request));
      return reply.status(204).send();
    },

    async updateMembership(request, reply) {
      const { membership_id } = read<{ membership_id: Uuid }>(request, 'params');
      const membership = await d.memberships.update(
        contextOf(request),
        membership_id,
        read(request, 'body'),
        parseIfMatch(request.headers['if-match']),
      );
      return reply.header('etag', etagFor(membership.revision)).send(membership);
    },

    // ------------------------------------------------------------ cuentas de servicio
    async createServiceAccount(request, reply) {
      const { organization_id } = read<{ organization_id: Uuid }>(request, 'params');
      const { value } = await d.serviceAccounts.create(
        contextOf(request),
        organization_id,
        read(request, 'body'),
        idempotencyKey(request),
      );
      return noStore(reply).status(201).send(value);
    },

    async rotateServiceAccount(request, reply) {
      const { service_account_id } = read<{ service_account_id: Uuid }>(request, 'params');
      const { value } = await d.serviceAccounts.rotate(
        contextOf(request),
        service_account_id,
        read(request, 'body'),
        idempotencyKey(request),
      );
      return noStore(reply).status(201).send(value);
    },

    async revokeServiceAccount(request) {
      const { service_account_id } = read<{ service_account_id: Uuid }>(request, 'params');
      const { reason } = read<{ reason: string }>(request, 'body');
      return d.serviceAccounts.revoke(contextOf(request), service_account_id, reason);
    },

    // ------------------------------------------------------------ dominios
    async registerDomain(request, reply) {
      const { site_id } = read<{ site_id: Uuid }>(request, 'params');
      const { value } = await d.domains.register(
        contextOf(request),
        site_id,
        read(request, 'body'),
        idempotencyKey(request),
      );
      return reply.status(201).send(value);
    },

    async verifyDomain(request) {
      const { domain_id } = read<{ domain_id: Uuid }>(request, 'params');
      return d.domains.verify(contextOf(request), domain_id);
    },

    async resolveHost(request, reply) {
      const { hostname } = read<{ hostname: string }>(request, 'params');
      const resolution = await d.domains.resolve(hostname);
      return sendPublicCacheable(request, reply, resolution, {
        maxAge: 30,
        sMaxAge: 300,
        staleWhileRevalidate: 60,
        surrogateKeys: [`host:${resolution.hostname}`, `org:${resolution.organization_id}`],
      });
    },

    // ------------------------------------------------------------ auditoría
    async listAuditEvents(request) {
      const { organization_id } = read<{ organization_id: Uuid }>(request, 'params');
      return d.me.listAuditEvents(contextOf(request), organization_id, read(request, 'query'));
    },
  };
}
