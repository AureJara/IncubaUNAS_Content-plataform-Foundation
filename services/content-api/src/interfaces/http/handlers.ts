import type { FastifyReply, FastifyRequest } from 'fastify';
import { contextOf, sendPublicCacheable, type OperationHandler } from '@incubaunas/http-kit';
import { etagFor, parseIfMatch, type Uuid } from '@incubaunas/shared-kernel';
import type { MediaService } from '../../application/media.js';
import type { PublishingService } from '../../application/publishing.js';
import type { PublicReadService } from '../../application/public-read.js';
import type { PageService, SiteService } from '../../application/sites-pages.js';

export interface ContentHandlerDependencies {
  sites: SiteService;
  pages: PageService;
  publishing: PublishingService;
  media: MediaService;
  publicRead: PublicReadService;
}

type Source = 'params' | 'query' | 'body';
const read = <T>(request: FastifyRequest, source: Source): T => request[source] as T;
const key = (request: FastifyRequest): string => String(request.headers['idempotency-key']);
const noStore = (reply: FastifyReply) => reply.header('cache-control', 'no-store');

/** Políticas de caché públicas: cache-first en el CDN, purga por surrogate key al publicar. */
const PUBLIC_CACHE = { maxAge: 30, sMaxAge: 300, staleWhileRevalidate: 60 } as const;

export function createContentHandlers(
  d: ContentHandlerDependencies,
): Record<string, OperationHandler> {
  return {
    // ------------------------------------------------------------ CMS: sitios
    async listSites(request) {
      return d.sites.list(contextOf(request), read(request, 'query'));
    },

    async createSite(request, reply) {
      const { value } = await d.sites.create(
        contextOf(request),
        read(request, 'body'),
        key(request),
      );
      return reply.status(201).header('etag', etagFor(value.revision)).send(value);
    },

    async getSite(request, reply) {
      const { site_id } = read<{ site_id: Uuid }>(request, 'params');
      const site = await d.sites.get(contextOf(request), site_id);
      return reply.header('etag', etagFor(site.revision)).send(site);
    },

    async updateSite(request, reply) {
      const { site_id } = read<{ site_id: Uuid }>(request, 'params');
      const site = await d.sites.update(
        contextOf(request),
        site_id,
        read(request, 'body'),
        parseIfMatch(request.headers['if-match']),
      );
      return reply.header('etag', etagFor(site.revision)).send(site);
    },

    // ------------------------------------------------------------ CMS: páginas
    async listPages(request) {
      const { site_id } = read<{ site_id: Uuid }>(request, 'params');
      return d.pages.list(contextOf(request), site_id, read(request, 'query'));
    },

    async createPage(request, reply) {
      const { site_id } = read<{ site_id: Uuid }>(request, 'params');
      const { value } = await d.pages.create(
        contextOf(request),
        site_id,
        read(request, 'body'),
        key(request),
      );
      return reply.status(201).header('etag', etagFor(value.revision)).send(value);
    },

    async getPage(request, reply) {
      const { page_id } = read<{ page_id: Uuid }>(request, 'params');
      const page = await d.pages.get(contextOf(request), page_id);
      return reply.header('etag', etagFor(page.revision)).send(page);
    },

    async updatePage(request, reply) {
      const { page_id } = read<{ page_id: Uuid }>(request, 'params');
      const page = await d.pages.update(
        contextOf(request),
        page_id,
        read(request, 'body'),
        parseIfMatch(request.headers['if-match']),
      );
      return reply.header('etag', etagFor(page.revision)).send(page);
    },

    async createPreviewToken(request, reply) {
      const { page_id } = read<{ page_id: Uuid }>(request, 'params');
      const { ttl_seconds } = read<{ ttl_seconds: number }>(request, 'body');
      const preview = await d.pages.createPreviewToken(contextOf(request), page_id, ttl_seconds);
      return noStore(reply).status(201).send(preview);
    },

    // ------------------------------------------------------------ CMS: publicaciones
    async publishPage(request, reply) {
      const { page_id } = read<{ page_id: Uuid }>(request, 'params');
      const { expected_revision } = read<{ expected_revision: number }>(request, 'body');
      const { value } = await d.publishing.publish(
        contextOf(request),
        page_id,
        expected_revision,
        key(request),
      );
      return reply.status(201).send(value);
    },

    async restorePage(request, reply) {
      const { page_id } = read<{ page_id: Uuid }>(request, 'params');
      const { source_version } = read<{ source_version: number }>(request, 'body');
      const { value } = await d.publishing.restore(
        contextOf(request),
        page_id,
        source_version,
        key(request),
      );
      return reply.status(201).send(value);
    },

    // ------------------------------------------------------------ CMS: medios
    async requestMediaUpload(request, reply) {
      const { value } = await d.media.requestUpload(
        contextOf(request),
        read(request, 'body'),
        key(request),
      );
      return noStore(reply).status(201).send(value);
    },

    async completeMediaUpload(request) {
      const { media_id } = read<{ media_id: Uuid }>(request, 'params');
      const { size_bytes } = read<{ size_bytes: number }>(request, 'body');
      return d.media.completeUpload(contextOf(request), media_id, size_bytes);
    },

    // ------------------------------------------------------------ lectura pública
    async getPublicSite(request, reply) {
      const { site_slug } = read<{ site_slug: string }>(request, 'params');
      const { locale } = read<{ locale?: string }>(request, 'query');
      const { dto } = await d.publicRead.getSite(site_slug, locale);
      return sendPublicCacheable(request, reply, dto, {
        ...PUBLIC_CACHE,
        surrogateKeys: [`site:${site_slug}`],
        vary: ['Accept-Encoding'],
      });
    },

    async getPublicPage(request, reply) {
      const { site_slug, page_path } = read<{ site_slug: string; page_path: string }>(
        request,
        'params',
      );
      const { locale } = read<{ locale?: string }>(request, 'query');
      const page = await d.publicRead.getPage(site_slug, page_path, locale);
      return sendPublicCacheable(request, reply, page, {
        ...PUBLIC_CACHE,
        surrogateKeys: [`site:${site_slug}`, `page:${site_slug}:${page.path}`],
      });
    },

    async listPublicEvents(request, reply) {
      const { site_slug } = read<{ site_slug: string }>(request, 'params');
      const events = await d.publicRead.listEvents(site_slug, read(request, 'query'));
      return sendPublicCacheable(request, reply, events, {
        ...PUBLIC_CACHE,
        surrogateKeys: [`site:${site_slug}`, `events:${site_slug}`],
      });
    },

    async getPublicEvent(request, reply) {
      const { site_slug, event_slug } = read<{ site_slug: string; event_slug: string }>(
        request,
        'params',
      );
      const event = await d.publicRead.getEvent(site_slug, event_slug);
      return sendPublicCacheable(request, reply, event, {
        ...PUBLIC_CACHE,
        surrogateKeys: [
          `site:${site_slug}`,
          `events:${site_slug}`,
          `event:${site_slug}:${event_slug}`,
        ],
      });
    },

    async getPreview(request, reply) {
      const { token } = read<{ token: string }>(request, 'params');
      const page = await d.publicRead.consumePreview(token);
      return noStore(reply).header('x-robots-tag', 'noindex').send(page);
    },
  };
}
