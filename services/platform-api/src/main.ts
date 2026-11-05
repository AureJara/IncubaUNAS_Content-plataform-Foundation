import { createPool } from '@incubaunas/db';
import { EventContractValidator, OutboxRelay, type EventPublisher } from '@incubaunas/events';
import { JoseTokenVerifier } from '@incubaunas/tenancy';
import { systemClock, uuidV7Generator } from '@incubaunas/shared-kernel';
import { buildApp } from './app.js';
import { DEFAULT_SESSION_POLICY } from './application/sessions.js';
import { loadConfig, originsOf } from './config.js';
import { AesGcmPiiProtector, RandomTokenGenerator } from './infrastructure/crypto.js';
import { NetworkDomainVerifier } from './infrastructure/domain-verifier.js';
import { SmtpInvitationNotifier } from './infrastructure/notifier.js';
import { OpenIdClientProvider } from './infrastructure/oidc.js';
import { PgUnitOfWork } from './infrastructure/pg/unit-of-work.js';

const config = loadConfig();
const validator = new EventContractValidator();
const pool = createPool({
  connectionString: config.PLATFORM_DATABASE_URL,
  applicationName: 'platform-api',
});

const { app } = await buildApp({
  uow: new PgUnitOfWork(pool, validator, systemClock),
  clock: systemClock,
  ids: uuidV7Generator,
  tokens: new RandomTokenGenerator(),
  pii: AesGcmPiiProtector.fromBase64(config.PII_ENCRYPTION_KEY),
  notifier: new SmtpInvitationNotifier({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    from: config.SMTP_FROM,
  }),
  oidc: new OpenIdClientProvider({
    issuer: config.OIDC_ISSUER,
    clientId: config.OIDC_CLIENT_ID,
    clientSecret: config.OIDC_CLIENT_SECRET,
    allowInsecureRequests: config.OIDC_ALLOW_INSECURE === 'true',
  }),
  domainVerifier: new NetworkDomainVerifier(),
  tokenVerifier: new JoseTokenVerifier({
    key: new TextEncoder().encode(config.INTERNAL_JWT_SECRET),
    issuer: config.INTERNAL_JWT_ISSUER,
    algorithms: ['HS256'],
  }),
  tokenAudience: config.INTERNAL_JWT_AUDIENCE,
  sessionPolicy: {
    ...DEFAULT_SESSION_POLICY,
    returnToOrigins: originsOf(config.OIDC_RETURN_TO_ALLOWLIST),
  },
  oidcRedirectUri: config.OIDC_REDIRECT_URI,
  csrfSecret: config.CSRF_SECRET,
  adminBaseUrl: config.ADMIN_BASE_URL,
  cookieNames: {
    session: config.SESSION_COOKIE_NAME,
    csrf: config.SESSION_COOKIE_NAME.replace('session', 'csrf'),
    loginAttempt: config.SESSION_COOKIE_NAME.replace('session', 'oidc'),
  },
  cookieSecure: config.COOKIE_SECURE === 'true',
  corsOrigins: originsOf([...config.OIDC_RETURN_TO_ALLOWLIST, config.ADMIN_BASE_URL]),
  logLevel: config.LOG_LEVEL,
});

// El broker de eventos es una decisión abierta (ARCHITECTURE-SPINE → Deferred). Mientras tanto el
// relay deja constancia en el log; el contrato y el outbox ya son los definitivos.
const logPublisher: EventPublisher = {
  async publish(envelope) {
    app.log.info(
      { topic: envelope.topic, domain_event_id: envelope.domain_event_id },
      'evento publicado (sin broker)',
    );
  },
};
const relay = new OutboxRelay(pool, logPublisher);
relay.start();

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'apagando');
  relay.stop();
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port: config.PLATFORM_API_PORT, host: '0.0.0.0' });
