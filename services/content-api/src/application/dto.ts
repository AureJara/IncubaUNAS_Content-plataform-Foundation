import type { MediaSnapshot } from '../domain/media.js';
import type { PageSnapshot, PublicationRecord } from '../domain/page.js';
import type { SiteSnapshot } from '../domain/site.js';
import type {
  PublicAvailabilityRow,
  PublicEventRow,
  PublicPageRow,
  PublicSiteRow,
} from './ports.js';

export const toSiteDto = (s: SiteSnapshot) => ({
  id: s.id,
  organization_id: s.organizationId,
  slug: s.slug,
  name: s.name,
  kind: s.kind,
  locale: s.locale,
  theme: s.theme,
  navigation: s.navigation,
  revision: s.revision,
  created_at: s.createdAt.toISOString(),
  updated_at: s.updatedAt.toISOString(),
});

export const toPageDto = (p: PageSnapshot) => ({
  id: p.id,
  organization_id: p.organizationId,
  site_id: p.siteId,
  path: p.path,
  title: p.title,
  locale: p.locale,
  blocks: p.blocks,
  seo: p.seo,
  published_version: p.publishedVersion,
  revision: p.revision,
  created_at: p.createdAt.toISOString(),
  updated_at: p.updatedAt.toISOString(),
});

export const toPublicationDto = (p: PublicationRecord) => ({
  id: p.id,
  page_id: p.pageId,
  version: p.version,
  content_hash: p.contentHash,
  restored_from_version: p.restoredFromVersion,
  published_at: p.publishedAt.toISOString(),
});

export const toMediaDto = (m: MediaSnapshot) => ({
  id: m.id,
  organization_id: m.organizationId,
  file_name: m.fileName,
  mime_type: m.mimeType,
  size_bytes: m.sizeBytes,
  alt_text: m.altText,
  state: m.state,
  created_at: m.createdAt.toISOString(),
});

// ---------------------------------------------------------------- lectura pública
export const toPublicSiteDto = (site: PublicSiteRow, pages: { path: string; title: string }[]) => ({
  slug: site.slug,
  name: site.name,
  locale: site.locale,
  theme: site.theme,
  navigation: site.navigation,
  pages,
});

export const toPublicPageDto = (p: PublicPageRow) => ({
  site_slug: p.siteSlug,
  path: p.path,
  title: p.title,
  locale: p.locale,
  blocks: p.blocks,
  seo: p.seo,
  publication_id: p.publicationId,
  version: p.version,
  content_hash: p.contentHash,
  published_at: p.publishedAt.toISOString(),
});

const registrationOf = (a: PublicAvailabilityRow | null) =>
  a
    ? {
        registration: {
          state: a.publicState,
          remaining_band: a.remainingBand,
          as_of: a.asOf.toISOString(),
        },
      }
    : {};

export const toPublicEventSummaryDto = (
  e: PublicEventRow & { availability: PublicAvailabilityRow | null },
) => ({
  slug: e.slug,
  title: e.title,
  kind: e.kind,
  starts_at: e.startsAt.toISOString(),
  ends_at: e.endsAt.toISOString(),
  timezone: e.timezone,
  status: e.status,
  ...registrationOf(e.availability),
});

export const toPublicEventDto = (
  e: PublicEventRow & { availability: PublicAvailabilityRow | null },
) => ({
  ...toPublicEventSummaryDto(e),
  description: e.description,
  publication_id: e.publicationId,
  release_version: e.releaseVersion,
  programs: e.programs,
  sessions: e.sessions,
});
