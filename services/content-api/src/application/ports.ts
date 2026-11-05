import type { Uuid } from '@incubaunas/shared-kernel';
import type { OutboxWriter, InboxStore } from '@incubaunas/events';
import type { AuditLog, IdempotencyStore } from '@incubaunas/service-kit';
import type { PageSnapshot, PublicationRecord, PublishedContent } from '../domain/page.js';
import type { MediaSnapshot } from '../domain/media.js';
import type { NavigationItem, SiteSnapshot, ThemeTokens } from '../domain/site.js';

export type {
  AuditEntry,
  AuditLog,
  IdempotencyScope,
  IdempotencyStore,
} from '@incubaunas/service-kit';

export interface TenantScope {
  organizationId?: Uuid | null;
}

export interface Keyset {
  createdAt: string;
  id: string;
}

// ---------------------------------------------------------------- tenant
export interface SiteRepository {
  insert(site: SiteSnapshot, actorId: Uuid | null): Promise<void>;
  findById(id: Uuid): Promise<SiteSnapshot | null>;
  update(site: SiteSnapshot, expectedRevision: number, actorId: Uuid | null): Promise<SiteSnapshot>;
  list(limit: number, after: Keyset | null): Promise<SiteSnapshot[]>;
}

export interface PageRepository {
  insert(page: PageSnapshot, actorId: Uuid | null): Promise<void>;
  findById(id: Uuid): Promise<PageSnapshot | null>;
  update(page: PageSnapshot, expectedRevision: number, actorId: Uuid | null): Promise<PageSnapshot>;
  list(siteId: Uuid, limit: number, after: Keyset | null): Promise<PageSnapshot[]>;
  markPublished(pageId: Uuid, version: number, now: Date): Promise<void>;
}

export interface PublicationRepository {
  insert(publication: PublicationRecord, actorId: Uuid | null): Promise<void>;
  findByVersion(pageId: Uuid, version: number): Promise<PublicationRecord | null>;
}

export interface PreviewTokenRepository {
  insert(token: {
    id: Uuid;
    organizationId: Uuid;
    pageId: Uuid;
    tokenHash: string;
    expiresAt: Date;
    createdBy: Uuid | null;
    createdAt: Date;
  }): Promise<void>;
  /** Consume el token en un solo paso atómico: válido, no usado y no vencido. */
  consume(tokenHash: string, now: Date): Promise<{ pageId: Uuid } | null>;
}

export interface MediaRepository {
  insert(media: MediaSnapshot, actorId: Uuid | null): Promise<void>;
  findById(id: Uuid): Promise<MediaSnapshot | null>;
  findMany(ids: readonly Uuid[]): Promise<MediaSnapshot[]>;
  update(media: MediaSnapshot, expectedRevision: number): Promise<MediaSnapshot>;
  listByState(state: MediaSnapshot['state'], limit: number): Promise<MediaSnapshot[]>;
}

// ---------------------------------------------------------------- modelo público de lectura
export interface PublicSiteRow {
  slug: string;
  siteId: Uuid;
  organizationId: Uuid;
  name: string;
  locale: string;
  theme: ThemeTokens;
  navigation: NavigationItem[];
}

export interface PublicPageRow {
  siteSlug: string;
  path: string;
  pageId: Uuid;
  publicationId: Uuid;
  version: number;
  title: string;
  locale: string;
  blocks: PublishedContent['blocks'];
  seo: PublishedContent['seo'];
  contentHash: string;
  publishedAt: Date;
}

export interface PublicEventRow {
  eventId: Uuid;
  siteId: Uuid;
  organizationId: Uuid;
  slug: string;
  title: string;
  kind: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  status: 'published' | 'closed' | 'cancelled';
  publicationId: Uuid;
  releaseVersion: number;
  programs: unknown[];
  sessions: unknown[];
}

export interface PublicAvailabilityRow {
  eventId: Uuid;
  publicState: 'not_open' | 'open' | 'waitlist_only' | 'closed';
  remainingBand: 'plenty' | 'few' | 'none' | null;
  asOf: Date;
}

/** Escritura de la proyección (la hace Content al publicar o al consumir eventos). */
export interface PublicReadModelWriter {
  upsertSite(row: PublicSiteRow, now: Date): Promise<void>;
  siteIsPublished(siteId: Uuid): Promise<boolean>;
  upsertPage(row: PublicPageRow): Promise<void>;
  upsertEvent(row: PublicEventRow, now: Date): Promise<void>;
  markEventStatus(eventId: Uuid, status: PublicEventRow['status'], now: Date): Promise<void>;
  upsertAvailability(row: PublicAvailabilityRow): Promise<void>;
}

/** Lectura pública: sin tenant, solo datos ya publicados. */
export interface PublicReadModelReader {
  getSite(
    slug: string,
  ): Promise<{ site: PublicSiteRow; pages: { path: string; title: string }[] } | null>;
  getPage(slug: string, path: string): Promise<PublicPageRow | null>;
  listEvents(
    slug: string,
    filter: { kind?: string; from?: Date; to?: Date },
    limit: number,
    after: { startsAt: string; id: string } | null,
  ): Promise<(PublicEventRow & { availability: PublicAvailabilityRow | null })[] | null>;
  getEvent(
    slug: string,
    eventSlug: string,
  ): Promise<(PublicEventRow & { availability: PublicAvailabilityRow | null }) | null>;
}

// ---------------------------------------------------------------- releases de evento
export interface EventReleaseRow {
  id: Uuid;
  organizationId: Uuid;
  eventId: Uuid;
  releaseVersion: number;
  status: 'pending' | 'active' | 'failed' | 'superseded';
  manifest: unknown | null;
  manifestHash: string;
  aggregateVersion: number;
  error: string | null;
}

export interface EventReleaseRepository {
  /** `false` si esta release ya estaba registrada (reentrega del mismo evento). */
  insertPending(row: EventReleaseRow, now: Date): Promise<boolean>;
  activate(id: Uuid, eventId: Uuid, now: Date): Promise<void>;
  markFailed(id: Uuid, error: string): Promise<void>;
  latestAggregateVersion(eventId: Uuid): Promise<number | null>;
}

// ---------------------------------------------------------------- puertos externos
export interface Repositories {
  sites: SiteRepository;
  pages: PageRepository;
  publications: PublicationRepository;
  previewTokens: PreviewTokenRepository;
  media: MediaRepository;
  eventReleases: EventReleaseRepository;
  publicWriter: PublicReadModelWriter;
  audit: AuditLog;
  idempotency: IdempotencyStore;
  outbox: OutboxWriter;
  inbox: InboxStore;
}

export interface UnitOfWork {
  run<T>(scope: TenantScope, work: (repositories: Repositories) => Promise<T>): Promise<T>;
}

export interface ObjectStorage {
  /** URL firmada de subida directa al almacenamiento de objetos. */
  presignUpload(input: {
    key: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    expiresAt: Date;
  }): Promise<{
    method: 'PUT';
    url: string;
    headers: Record<string, string>;
  }>;
  /** Tamaño del objeto subido, o `null` si no existe. */
  head(key: string): Promise<{ sizeBytes: number } | null>;
}

export interface MalwareScanner {
  scan(input: {
    storageKey: string;
    mimeType: string;
    sha256: string;
  }): Promise<'clean' | 'infected'>;
}

export interface ReleaseManifestFetcher {
  fetch(manifestRef: string): Promise<unknown>;
}

export interface TokenGenerator {
  generate(): string;
}
