import type { Uuid } from '@incubaunas/shared-kernel';
import type { DbClient, Pool } from '@incubaunas/db';
import type {
  PublicAvailabilityRow,
  PublicEventRow,
  PublicPageRow,
  PublicReadModelReader,
  PublicReadModelWriter,
  PublicSiteRow,
} from '../../application/ports.js';

interface EventDbRow {
  event_id: string;
  site_id: string;
  organization_id: string;
  slug: string;
  title: string;
  kind: string;
  description: string | null;
  starts_at: Date;
  ends_at: Date;
  timezone: string;
  status: PublicEventRow['status'];
  publication_id: string;
  release_version: number;
  programs: unknown[];
  sessions: unknown[];
  a_state: PublicAvailabilityRow['publicState'] | null;
  a_band: PublicAvailabilityRow['remainingBand'];
  a_as_of: Date | null;
}

const toEvent = (
  row: EventDbRow,
): PublicEventRow & { availability: PublicAvailabilityRow | null } => ({
  eventId: row.event_id,
  siteId: row.site_id,
  organizationId: row.organization_id,
  slug: row.slug,
  title: row.title,
  kind: row.kind,
  description: row.description,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  timezone: row.timezone,
  status: row.status,
  publicationId: row.publication_id,
  releaseVersion: row.release_version,
  programs: row.programs,
  sessions: row.sessions,
  availability:
    row.a_state && row.a_as_of
      ? {
          eventId: row.event_id,
          publicState: row.a_state,
          remainingBand: row.a_band,
          asOf: row.a_as_of,
        }
      : null,
});

const EVENT_SELECT = `
  select e.*, a.public_state as a_state, a.remaining_band as a_band, a.as_of as a_as_of
    from public_events e
    left join public_event_availability a on a.event_id = e.event_id`;

/** Escritura de la proyección: corre dentro de la transacción del comando o del consumidor. */
export class PgPublicWriter implements PublicReadModelWriter {
  constructor(private readonly client: DbClient) {}

  async upsertSite(row: PublicSiteRow, now: Date): Promise<void> {
    await this.client.query(
      `insert into public_sites (slug, site_id, organization_id, name, locale, theme, navigation, updated_at)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
       on conflict (slug) do update set name = excluded.name, locale = excluded.locale, theme = excluded.theme,
                                        navigation = excluded.navigation, updated_at = excluded.updated_at`,
      [
        row.slug,
        row.siteId,
        row.organizationId,
        row.name,
        row.locale,
        JSON.stringify(row.theme),
        JSON.stringify(row.navigation),
        now,
      ],
    );
  }

  async siteIsPublished(siteId: Uuid): Promise<boolean> {
    const { rowCount } = await this.client.query('select 1 from public_sites where site_id = $1', [
      siteId,
    ]);
    return (rowCount ?? 0) > 0;
  }

  async upsertPage(row: PublicPageRow): Promise<void> {
    await this.client.query(
      `insert into public_pages (site_slug, path, page_id, publication_id, version, title, locale, blocks, seo, content_hash, published_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)
       on conflict (site_slug, path) do update set page_id = excluded.page_id, publication_id = excluded.publication_id,
         version = excluded.version, title = excluded.title, locale = excluded.locale, blocks = excluded.blocks,
         seo = excluded.seo, content_hash = excluded.content_hash, published_at = excluded.published_at
       where excluded.version >= public_pages.version`,
      [
        row.siteSlug,
        row.path,
        row.pageId,
        row.publicationId,
        row.version,
        row.title,
        row.locale,
        JSON.stringify(row.blocks),
        JSON.stringify(row.seo),
        row.contentHash,
        row.publishedAt,
      ],
    );
  }

  async upsertEvent(row: PublicEventRow, now: Date): Promise<void> {
    await this.client.query(
      `insert into public_events (event_id, site_id, organization_id, slug, title, kind, description, starts_at, ends_at,
                                  timezone, status, publication_id, release_version, programs, sessions, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16)
       on conflict (event_id) do update set site_id = excluded.site_id, slug = excluded.slug, title = excluded.title,
         kind = excluded.kind, description = excluded.description, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
         timezone = excluded.timezone, status = excluded.status, publication_id = excluded.publication_id,
         release_version = excluded.release_version, programs = excluded.programs, sessions = excluded.sessions,
         updated_at = excluded.updated_at
       where excluded.release_version >= public_events.release_version`,
      [
        row.eventId,
        row.siteId,
        row.organizationId,
        row.slug,
        row.title,
        row.kind,
        row.description,
        row.startsAt,
        row.endsAt,
        row.timezone,
        row.status,
        row.publicationId,
        row.releaseVersion,
        JSON.stringify(row.programs),
        JSON.stringify(row.sessions),
        now,
      ],
    );
  }

  async markEventStatus(eventId: Uuid, status: PublicEventRow['status'], now: Date): Promise<void> {
    await this.client.query(
      'update public_events set status = $2, updated_at = $3 where event_id = $1',
      [eventId, status, now],
    );
  }

  async upsertAvailability(row: PublicAvailabilityRow): Promise<void> {
    // Solo avanza: un mensaje viejo que llega tarde no pisa a uno más reciente.
    await this.client.query(
      `insert into public_event_availability (event_id, public_state, remaining_band, as_of) values ($1, $2, $3, $4)
       on conflict (event_id) do update set public_state = excluded.public_state, remaining_band = excluded.remaining_band,
                                            as_of = excluded.as_of
       where excluded.as_of > public_event_availability.as_of`,
      [row.eventId, row.publicState, row.remainingBand, row.asOf],
    );
  }
}

/** Lectura pública: consultas sin tenant sobre datos ya publicados. */
export class PgPublicReader implements PublicReadModelReader {
  constructor(private readonly pool: Pool) {}

  async getSite(slug: string) {
    const { rows } = await this.pool.query('select * from public_sites where slug = $1', [slug]);
    const site = rows[0];
    if (!site) return null;
    const pages = await this.pool.query<{ path: string; title: string }>(
      'select path, title from public_pages where site_slug = $1 order by path',
      [slug],
    );
    return {
      site: {
        slug: site.slug,
        siteId: site.site_id,
        organizationId: site.organization_id,
        name: site.name,
        locale: site.locale,
        theme: site.theme,
        navigation: site.navigation,
      },
      pages: pages.rows,
    };
  }

  async getPage(slug: string, path: string): Promise<PublicPageRow | null> {
    const { rows } = await this.pool.query(
      'select * from public_pages where site_slug = $1 and path = $2',
      [slug, path],
    );
    const row = rows[0];
    return row
      ? {
          siteSlug: row.site_slug,
          path: row.path,
          pageId: row.page_id,
          publicationId: row.publication_id,
          version: row.version,
          title: row.title,
          locale: row.locale,
          blocks: row.blocks,
          seo: row.seo,
          contentHash: row.content_hash,
          publishedAt: row.published_at,
        }
      : null;
  }

  async listEvents(
    slug: string,
    filter: { kind?: string; from?: Date; to?: Date },
    limit: number,
    after: { startsAt: string; id: string } | null,
  ) {
    const site = await this.pool.query<{ site_id: string }>(
      'select site_id from public_sites where slug = $1',
      [slug],
    );
    if (!site.rows[0]) return null;

    const params: unknown[] = [site.rows[0].site_id];
    const where = ['e.site_id = $1'];
    if (filter.kind) where.push(`e.kind = $${params.push(filter.kind)}`);
    if (filter.from) where.push(`e.ends_at >= $${params.push(filter.from)}`);
    if (filter.to) where.push(`e.starts_at <= $${params.push(filter.to)}`);
    if (after) {
      const at = params.push(after.startsAt);
      const id = params.push(after.id);
      where.push(`(e.starts_at, e.event_id) > ($${at}::timestamptz, $${id}::uuid)`);
    }
    params.push(limit);

    const { rows } = await this.pool.query<EventDbRow>(
      `${EVENT_SELECT} where ${where.join(' and ')} order by e.starts_at, e.event_id limit $${params.length}`,
      params,
    );
    return rows.map(toEvent);
  }

  async getEvent(slug: string, eventSlug: string) {
    const { rows } = await this.pool.query<EventDbRow>(
      `${EVENT_SELECT}
        join public_sites s on s.site_id = e.site_id
        where s.slug = $1 and e.slug = $2`,
      [slug, eventSlug],
    );
    return rows[0] ? toEvent(rows[0]) : null;
  }
}
