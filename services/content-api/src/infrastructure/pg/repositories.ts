import { AppError, staleRevision, type Uuid } from '@incubaunas/shared-kernel';
import { isUniqueViolation, type DbClient } from '@incubaunas/db';
import type { Block } from '../../domain/blocks.js';
import type { MediaSnapshot, MediaState } from '../../domain/media.js';
import type { PageSnapshot, PublicationRecord } from '../../domain/page.js';
import type { SiteSnapshot } from '../../domain/site.js';
import type {
  EventReleaseRepository,
  EventReleaseRow,
  Keyset,
  MediaRepository,
  PageRepository,
  PreviewTokenRepository,
  PublicationRepository,
  SiteRepository,
} from '../../application/ports.js';

// ---------------------------------------------------------------- sitios
interface SiteRow {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  kind: SiteSnapshot['kind'];
  locale: string;
  theme: SiteSnapshot['theme'];
  navigation: SiteSnapshot['navigation'];
  revision: string | number;
  created_at: Date;
  updated_at: Date;
}

const toSite = (row: SiteRow): SiteSnapshot => ({
  id: row.id,
  organizationId: row.organization_id,
  slug: row.slug,
  name: row.name,
  kind: row.kind,
  locale: row.locale,
  theme: row.theme,
  navigation: row.navigation,
  revision: Number(row.revision),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class PgSiteRepository implements SiteRepository {
  constructor(private readonly client: DbClient) {}

  async insert(s: SiteSnapshot, actorId: Uuid | null): Promise<void> {
    try {
      await this.client.query(
        `insert into sites (id, organization_id, slug, name, kind, locale, theme, navigation, revision, created_at, updated_at, created_by, updated_by)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $10, $11, $11)`,
        [
          s.id,
          s.organizationId,
          s.slug,
          s.name,
          s.kind,
          s.locale,
          JSON.stringify(s.theme),
          JSON.stringify(s.navigation),
          s.revision,
          s.createdAt,
          actorId,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error, 'sites_slug_key')) {
        throw new AppError('already_exists', 409, 'Ese slug de sitio ya está en uso.', [
          { pointer: '/slug', code: 'unique', message: 'Elige otro slug.' },
        ]);
      }
      throw error;
    }
  }

  async findById(id: Uuid): Promise<SiteSnapshot | null> {
    const { rows } = await this.client.query<SiteRow>('select * from sites where id = $1', [id]);
    return rows[0] ? toSite(rows[0]) : null;
  }

  async update(
    s: SiteSnapshot,
    expectedRevision: number,
    actorId: Uuid | null,
  ): Promise<SiteSnapshot> {
    const { rows } = await this.client.query<SiteRow>(
      `update sites set name = $3, locale = $4, theme = $5::jsonb, navigation = $6::jsonb, updated_at = $7,
                        updated_by = $8, revision = revision + 1
        where id = $1 and revision = $2 returning *`,
      [
        s.id,
        expectedRevision,
        s.name,
        s.locale,
        JSON.stringify(s.theme),
        JSON.stringify(s.navigation),
        s.updatedAt,
        actorId,
      ],
    );
    if (!rows[0]) throw staleRevision();
    return toSite(rows[0]);
  }

  async list(limit: number, after: Keyset | null): Promise<SiteSnapshot[]> {
    const { rows } = await this.client.query<SiteRow>(
      `select * from sites
        where ($1::timestamptz is null or (created_at, id) > ($1::timestamptz, $2::uuid))
        order by created_at, id limit $3`,
      [after?.createdAt ?? null, after?.id ?? null, limit],
    );
    return rows.map(toSite);
  }
}

// ---------------------------------------------------------------- páginas
interface PageRow {
  id: string;
  organization_id: string;
  site_id: string;
  path: string;
  title: string;
  locale: string;
  blocks: Block[];
  seo: PageSnapshot['seo'];
  published_version: number | null;
  revision: string | number;
  created_at: Date;
  updated_at: Date;
}

const toPageSnapshot = (row: PageRow): PageSnapshot => ({
  id: row.id,
  organizationId: row.organization_id,
  siteId: row.site_id,
  path: row.path,
  title: row.title,
  locale: row.locale,
  blocks: row.blocks,
  seo: row.seo,
  publishedVersion: row.published_version,
  revision: Number(row.revision),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class PgPageRepository implements PageRepository {
  constructor(private readonly client: DbClient) {}

  async insert(p: PageSnapshot, actorId: Uuid | null): Promise<void> {
    try {
      await this.client.query(
        `insert into pages (id, organization_id, site_id, path, title, locale, blocks, seo, revision, created_at, updated_at, created_by, updated_by)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $10, $11, $11)`,
        [
          p.id,
          p.organizationId,
          p.siteId,
          p.path,
          p.title,
          p.locale,
          JSON.stringify(p.blocks),
          JSON.stringify(p.seo),
          p.revision,
          p.createdAt,
          actorId,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error, 'pages_site_id_path_key')) {
        throw new AppError(
          'already_exists',
          409,
          'Ya existe una página con esa ruta en el sitio.',
          [{ pointer: '/path', code: 'unique', message: 'Elige otra ruta.' }],
        );
      }
      throw error;
    }
  }

  async findById(id: Uuid): Promise<PageSnapshot | null> {
    const { rows } = await this.client.query<PageRow>('select * from pages where id = $1', [id]);
    return rows[0] ? toPageSnapshot(rows[0]) : null;
  }

  async update(
    p: PageSnapshot,
    expectedRevision: number,
    actorId: Uuid | null,
  ): Promise<PageSnapshot> {
    const { rows } = await this.client.query<PageRow>(
      `update pages set title = $3, blocks = $4::jsonb, seo = $5::jsonb, updated_at = $6, updated_by = $7, revision = revision + 1
        where id = $1 and revision = $2 returning *`,
      [
        p.id,
        expectedRevision,
        p.title,
        JSON.stringify(p.blocks),
        JSON.stringify(p.seo),
        p.updatedAt,
        actorId,
      ],
    );
    if (!rows[0]) throw staleRevision();
    return toPageSnapshot(rows[0]);
  }

  async list(siteId: Uuid, limit: number, after: Keyset | null): Promise<PageSnapshot[]> {
    const { rows } = await this.client.query<PageRow>(
      `select * from pages
        where site_id = $1 and ($2::timestamptz is null or (created_at, id) > ($2::timestamptz, $3::uuid))
        order by created_at, id limit $4`,
      [siteId, after?.createdAt ?? null, after?.id ?? null, limit],
    );
    return rows.map(toPageSnapshot);
  }

  async markPublished(pageId: Uuid, version: number, now: Date): Promise<void> {
    await this.client.query(
      'update pages set published_version = $2, updated_at = $3 where id = $1',
      [pageId, version, now],
    );
  }
}

// ---------------------------------------------------------------- publicaciones y vistas previas
export class PgPublicationRepository implements PublicationRepository {
  constructor(private readonly client: DbClient) {}

  async insert(p: PublicationRecord, actorId: Uuid | null): Promise<void> {
    await this.client.query(
      `insert into page_publications (id, organization_id, page_id, version, snapshot, content_hash, restored_from_version, published_at, published_by)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)`,
      [
        p.id,
        p.organizationId,
        p.pageId,
        p.version,
        JSON.stringify(p.snapshot),
        p.contentHash,
        p.restoredFromVersion,
        p.publishedAt,
        actorId,
      ],
    );
  }

  async findByVersion(pageId: Uuid, version: number): Promise<PublicationRecord | null> {
    const { rows } = await this.client.query(
      'select * from page_publications where page_id = $1 and version = $2',
      [pageId, version],
    );
    const row = rows[0];
    return row
      ? {
          id: row.id,
          organizationId: row.organization_id,
          pageId: row.page_id,
          version: row.version,
          snapshot: row.snapshot,
          contentHash: row.content_hash,
          restoredFromVersion: row.restored_from_version,
          publishedAt: row.published_at,
        }
      : null;
  }
}

export class PgPreviewTokenRepository implements PreviewTokenRepository {
  constructor(private readonly client: DbClient) {}

  async insert(t: Parameters<PreviewTokenRepository['insert']>[0]): Promise<void> {
    await this.client.query(
      `insert into preview_tokens (id, organization_id, page_id, token_hash, expires_at, created_by, created_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [t.id, t.organizationId, t.pageId, t.tokenHash, t.expiresAt, t.createdBy, t.createdAt],
    );
  }

  async consume(tokenHash: string, now: Date): Promise<{ pageId: Uuid } | null> {
    const { rows } = await this.client.query<{ page_id: string }>(
      `update preview_tokens set used_at = $2
        where token_hash = $1 and used_at is null and expires_at > $2
        returning page_id`,
      [tokenHash, now],
    );
    return rows[0] ? { pageId: rows[0].page_id } : null;
  }
}

// ---------------------------------------------------------------- medios
interface MediaRow {
  id: string;
  organization_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: string | number;
  sha256: string;
  alt_text: string | null;
  storage_key: string;
  state: MediaState;
  revision: string | number;
  created_at: Date;
  updated_at: Date;
}

const toMedia = (row: MediaRow): MediaSnapshot => ({
  id: row.id,
  organizationId: row.organization_id,
  fileName: row.file_name,
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes),
  sha256: row.sha256,
  altText: row.alt_text,
  storageKey: row.storage_key,
  state: row.state,
  revision: Number(row.revision),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class PgMediaRepository implements MediaRepository {
  constructor(private readonly client: DbClient) {}

  async insert(m: MediaSnapshot, actorId: Uuid | null): Promise<void> {
    await this.client.query(
      `insert into media_assets (id, organization_id, file_name, mime_type, size_bytes, sha256, alt_text, storage_key, state, revision, created_at, updated_at, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12)`,
      [
        m.id,
        m.organizationId,
        m.fileName,
        m.mimeType,
        m.sizeBytes,
        m.sha256,
        m.altText,
        m.storageKey,
        m.state,
        m.revision,
        m.createdAt,
        actorId,
      ],
    );
  }

  async findById(id: Uuid): Promise<MediaSnapshot | null> {
    const { rows } = await this.client.query<MediaRow>('select * from media_assets where id = $1', [
      id,
    ]);
    return rows[0] ? toMedia(rows[0]) : null;
  }

  async findMany(ids: readonly Uuid[]): Promise<MediaSnapshot[]> {
    const { rows } = await this.client.query<MediaRow>(
      'select * from media_assets where id = any($1::uuid[])',
      [ids],
    );
    return rows.map(toMedia);
  }

  async update(m: MediaSnapshot, expectedRevision: number): Promise<MediaSnapshot> {
    const { rows } = await this.client.query<MediaRow>(
      `update media_assets set state = $3, updated_at = $4, revision = revision + 1
        where id = $1 and revision = $2 returning *`,
      [m.id, expectedRevision, m.state, m.updatedAt],
    );
    if (!rows[0]) throw staleRevision();
    return toMedia(rows[0]);
  }

  async listByState(state: MediaState, limit: number): Promise<MediaSnapshot[]> {
    const { rows } = await this.client.query<MediaRow>(
      'select * from media_assets where state = $1 order by created_at, id limit $2',
      [state, limit],
    );
    return rows.map(toMedia);
  }
}

// ---------------------------------------------------------------- releases de evento
export class PgEventReleaseRepository implements EventReleaseRepository {
  constructor(private readonly client: DbClient) {}

  async insertPending(row: EventReleaseRow, now: Date): Promise<boolean> {
    const result = await this.client.query(
      `insert into event_releases (id, organization_id, event_id, release_version, status, manifest, manifest_hash, aggregate_version, created_at)
       values ($1, $2, $3, $4, 'pending', $5::jsonb, $6, $7, $8)
       on conflict (id) do nothing`,
      [
        row.id,
        row.organizationId,
        row.eventId,
        row.releaseVersion,
        JSON.stringify(row.manifest),
        row.manifestHash,
        row.aggregateVersion,
        now,
      ],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Atómico: la anterior pasa a `superseded` y la nueva a `active` en la misma transacción. */
  async activate(id: Uuid, eventId: Uuid, now: Date): Promise<void> {
    await this.client.query(
      `update event_releases set status = 'superseded' where event_id = $1 and status = 'active'`,
      [eventId],
    );
    await this.client.query(
      `update event_releases set status = 'active', activated_at = $2 where id = $1`,
      [id, now],
    );
  }

  async markFailed(id: Uuid, error: string): Promise<void> {
    await this.client.query(
      `update event_releases set status = 'failed', error = $2 where id = $1`,
      [id, error],
    );
  }

  async latestAggregateVersion(eventId: Uuid): Promise<number | null> {
    const { rows } = await this.client.query<{ v: number | null }>(
      'select max(aggregate_version) as v from event_releases where event_id = $1',
      [eventId],
    );
    return rows[0]?.v ?? null;
  }
}
