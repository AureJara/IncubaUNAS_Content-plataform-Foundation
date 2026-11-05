import { randomToken, systemClock, uuidV7Generator } from '@incubaunas/shared-kernel';
import { createPool } from '@incubaunas/db';
import { EventContractValidator, OutboxRelay, type EventPublisher } from '@incubaunas/events';
import { JoseTokenVerifier } from '@incubaunas/tenancy';
import { buildContentApp } from './app.js';
import { loadConfig } from './config.js';
import {
  HttpManifestFetcher,
  InMemoryObjectStorage,
  UnconfiguredMalwareScanner,
} from './infrastructure/adapters.js';
import { PgPublicReader } from './infrastructure/pg/public-read.js';
import { PgUnitOfWork } from './infrastructure/pg/unit-of-work.js';

const config = loadConfig();
const pool = createPool({
  connectionString: config.CONTENT_DATABASE_URL,
  applicationName: 'content-api',
});

const { app } = await buildContentApp({
  uow: new PgUnitOfWork(pool, new EventContractValidator(), systemClock),
  reader: new PgPublicReader(pool),
  clock: systemClock,
  ids: uuidV7Generator,
  tokens: { generate: () => randomToken(32) },
  // Pendientes de decisión de despliegue: almacenamiento de objetos, escáner de malware y broker.
  storage: new InMemoryObjectStorage(),
  scanner: new UnconfiguredMalwareScanner(),
  fetcher: new HttpManifestFetcher('http://localhost:4002', async () => {
    throw new Error('Event Configuration aún no expone el manifiesto en este entorno.');
  }),
  tokenVerifier: new JoseTokenVerifier({
    key: new TextEncoder().encode(config.INTERNAL_JWT_SECRET),
    issuer: config.INTERNAL_JWT_ISSUER,
    algorithms: ['HS256'],
  }),
  tokenAudience: config.CONTENT_JWT_AUDIENCE,
  previewBaseUrl: config.PREVIEW_BASE_URL,
  corsOrigins: config.OIDC_RETURN_TO_ALLOWLIST.map((url) => new URL(url).origin),
  logLevel: config.LOG_LEVEL,
});

// Mientras no haya broker, el relay deja constancia en el log; el contrato y el outbox ya son los definitivos.
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

await app.listen({ port: config.CONTENT_API_PORT, host: '0.0.0.0' });
