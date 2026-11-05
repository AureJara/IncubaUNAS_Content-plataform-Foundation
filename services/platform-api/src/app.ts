import type { FastifyInstance } from 'fastify';
import {
  BearerTokenAuthenticator,
  bindOperations,
  createServer,
  loadOperations,
  type ApiOperation,
} from '@incubaunas/http-kit';
import { hmacHex, type Clock, type IdGenerator } from '@incubaunas/shared-kernel';
import type { TokenVerifier } from '@incubaunas/tenancy';
import { DomainService } from './application/domains.js';
import { DomainEvents } from './application/domain-events.js';
import { InvitationService } from './application/invitations.js';
import { MeService } from './application/me.js';
import { MembershipService } from './application/memberships.js';
import { OrganizationService } from './application/organizations.js';
import { ServiceAccountService } from './application/service-accounts.js';
import { SessionService, type SessionPolicy } from './application/sessions.js';
import type {
  DomainVerifier,
  InvitationNotifier,
  OidcProvider,
  PiiProtector,
  TokenGenerator,
  UnitOfWork,
} from './application/ports.js';
import type { PlatformDeps } from './application/deps.js';
import { SessionCookieAuthenticator } from './interfaces/http/authenticators.js';
import { SessionCookies } from './interfaces/http/cookies.js';
import { createHandlers } from './interfaces/http/handlers.js';

/** Ruta del contrato OpenAPI que gobierna este servicio. */
export const PLATFORM_OPENAPI = new URL(
  '../../../contracts/openapi/platform.v1.yaml',
  import.meta.url,
);

export interface AppDependencies {
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  tokens: TokenGenerator;
  pii: PiiProtector;
  notifier: InvitationNotifier;
  oidc: OidcProvider;
  domainVerifier: DomainVerifier;
  tokenVerifier: TokenVerifier;
  sessionPolicy: SessionPolicy;
  oidcRedirectUri: string;
  csrfSecret: string;
  adminBaseUrl: string;
  tokenAudience: string;
  cookieNames: { session: string; csrf: string; loginAttempt: string };
  cookieSecure: boolean;
  corsOrigins: readonly string[];
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'silent';
  rateLimitPerMinute?: number;
}

export interface BuiltApp {
  app: FastifyInstance;
  operations: ApiOperation[];
  sessions: SessionService;
}

/**
 * Raíz de composición: es el único lugar que conoce las implementaciones concretas. Todo lo demás
 * depende de los puertos, por eso cada pieza se puede reemplazar en las pruebas.
 */
export async function buildApp(dependencies: AppDependencies): Promise<BuiltApp> {
  const d = dependencies;
  const platform: PlatformDeps = {
    uow: d.uow,
    clock: d.clock,
    ids: d.ids,
    tokens: d.tokens,
    pii: d.pii,
    events: new DomainEvents(d.ids, d.clock),
    notifier: d.notifier,
    adminBaseUrl: d.adminBaseUrl,
  };

  const sessions = new SessionService({
    uow: d.uow,
    clock: d.clock,
    ids: d.ids,
    tokens: d.tokens,
    pii: d.pii,
    oidc: d.oidc,
    policy: d.sessionPolicy,
    redirectUri: d.oidcRedirectUri,
    csrfKey: d.csrfSecret,
  });

  const app = await createServer({
    serviceName: 'platform-api',
    corsOrigins: d.corsOrigins,
    logLevel: d.logLevel,
    rateLimitPerMinute: d.rateLimitPerMinute,
    authenticators: {
      sessionCookie: new SessionCookieAuthenticator(sessions, d.cookieNames.session),
      bearerAuth: new BearerTokenAuthenticator(d.tokenVerifier, d.tokenAudience),
    },
  });

  const operations = await loadOperations(
    PLATFORM_OPENAPI.pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  );
  bindOperations(
    app,
    operations,
    createHandlers({
      organizations: new OrganizationService(platform),
      memberships: new MembershipService(platform),
      invitations: new InvitationService(platform),
      me: new MeService(platform),
      sessions,
      serviceAccounts: new ServiceAccountService(platform),
      domains: new DomainService(platform, d.domainVerifier),
      cookies: new SessionCookies({ names: d.cookieNames, secure: d.cookieSecure }),
      oidcRedirectUri: d.oidcRedirectUri,
      ipPseudonymKey: hmacHex(d.csrfSecret, 'ip-pseudonym-key-v1'),
    }),
  );

  return { app, operations, sessions };
}
