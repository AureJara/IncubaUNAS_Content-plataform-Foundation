import type { FastifyInstance } from 'fastify';
import {
  BearerTokenAuthenticator,
  bindOperations,
  createServer,
  loadOperations,
  type ApiOperation,
} from '@incubaunas/http-kit';
import type { Clock, IdGenerator } from '@incubaunas/shared-kernel';
import type { TokenVerifier } from '@incubaunas/tenancy';
import { BlockValidator } from './domain/blocks.js';
import type { ContentDeps } from './application/deps.js';
import { MediaService } from './application/media.js';
import { EventProjectionService } from './application/projections.js';
import type {
  MalwareScanner,
  ObjectStorage,
  PublicReadModelReader,
  ReleaseManifestFetcher,
  TokenGenerator,
  UnitOfWork,
} from './application/ports.js';
import { PublicReadService } from './application/public-read.js';
import { PublishingService } from './application/publishing.js';
import { PageService, SiteService } from './application/sites-pages.js';
import { createContentHandlers } from './interfaces/http/handlers.js';
import { readFileSync } from 'node:fs';

const contractPath = (relative: string): string =>
  new URL(`../../../contracts/${relative}`, import.meta.url).pathname.replace(
    /^\/([A-Za-z]:)/,
    '$1',
  );

/** Ambos contratos HTTP gobiernan este servicio: la API de CMS y la de lectura pública. */
export const CONTENT_OPENAPI = [
  contractPath('openapi/cms.v1.yaml'),
  contractPath('openapi/public-read.v1.yaml'),
];
export const MANIFEST_SCHEMA = contractPath('schemas/release-manifest.v1.json');

export interface ContentAppDependencies {
  uow: UnitOfWork;
  reader: PublicReadModelReader;
  clock: Clock;
  ids: IdGenerator;
  tokens: TokenGenerator;
  storage: ObjectStorage;
  scanner: MalwareScanner;
  fetcher: ReleaseManifestFetcher;
  tokenVerifier: TokenVerifier;
  tokenAudience: string;
  previewBaseUrl: string;
  corsOrigins: readonly string[];
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'silent';
  rateLimitPerMinute?: number;
}

export interface BuiltContentApp {
  app: FastifyInstance;
  operations: ApiOperation[];
  media: MediaService;
  projections: EventProjectionService;
}

/** Raíz de composición de Content: el único lugar que conoce las implementaciones concretas. */
export async function buildContentApp(d: ContentAppDependencies): Promise<BuiltContentApp> {
  const deps: ContentDeps = {
    uow: d.uow,
    reader: d.reader,
    clock: d.clock,
    ids: d.ids,
    tokens: d.tokens,
    blocks: new BlockValidator(),
    storage: d.storage,
    scanner: d.scanner,
    fetcher: d.fetcher,
    previewBaseUrl: d.previewBaseUrl,
  };

  const app = await createServer({
    serviceName: 'content-api',
    corsOrigins: d.corsOrigins,
    logLevel: d.logLevel,
    rateLimitPerMinute: d.rateLimitPerMinute,
    authenticators: { bearerAuth: new BearerTokenAuthenticator(d.tokenVerifier, d.tokenAudience) },
  });

  const operations = (
    await Promise.all(CONTENT_OPENAPI.map((file) => loadOperations(file)))
  ).flat();
  const media = new MediaService(deps);
  bindOperations(
    app,
    operations,
    createContentHandlers({
      sites: new SiteService(deps),
      pages: new PageService(deps),
      publishing: new PublishingService(deps),
      media,
      publicRead: new PublicReadService(deps),
    }),
  );

  const projections = new EventProjectionService(
    deps,
    JSON.parse(readFileSync(MANIFEST_SCHEMA, 'utf8')),
  );
  return { app, operations, media, projections };
}
