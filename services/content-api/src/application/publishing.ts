import { notFound, staleRevision, type Uuid } from '@incubaunas/shared-kernel';
import { runIdempotent } from '@incubaunas/service-kit';
import { buildEnvelope } from '@incubaunas/events';
import type { RequestContext } from '@incubaunas/tenancy';
import { BlockValidator } from '../domain/blocks.js';
import { assertUsable } from '../domain/media.js';
import {
  newPublication,
  snapshotOf,
  type PageSnapshot,
  type PublicationRecord,
  type PublishedContent,
} from '../domain/page.js';
import { ownTenant, recordAudit, type ContentDeps } from './deps.js';
import { toPublicationDto } from './dto.js';
import type { Repositories } from './ports.js';

/**
 * Publicar congela un snapshot inmutable con hash, actualiza la proyección pública y emite el evento
 * en una sola transacción: o ocurre todo, o no ocurre nada (PF-034, PF-035).
 */
export class PublishingService {
  constructor(private readonly deps: ContentDeps) {}

  async publish(ctx: RequestContext, pageId: Uuid, expectedRevision: number, key: string) {
    ctx.authz.require('sites:publish');
    const organizationId = ownTenant(ctx);
    const { uow, clock } = this.deps;

    return uow.run({ organizationId }, (r) =>
      runIdempotent(
        r.idempotency,
        clock,
        { organizationId, actorId: ctx.actor.id, operation: 'page.publish' },
        key,
        { pageId, expectedRevision },
        async () => {
          const page = await r.pages.findById(pageId);
          if (!page) throw notFound('La página');
          if (page.revision !== expectedRevision) throw staleRevision();
          return this.createPublication(r, ctx, page, snapshotOf(page));
        },
      ),
    );
  }

  /** Restaurar crea una publicación nueva con el contenido antiguo; el snapshot original no se toca. */
  async restore(ctx: RequestContext, pageId: Uuid, sourceVersion: number, key: string) {
    ctx.authz.require('sites:publish');
    const organizationId = ownTenant(ctx);
    const { uow, clock } = this.deps;

    return uow.run({ organizationId }, (r) =>
      runIdempotent(
        r.idempotency,
        clock,
        { organizationId, actorId: ctx.actor.id, operation: 'page.restore' },
        key,
        { pageId, sourceVersion },
        async () => {
          const page = await r.pages.findById(pageId);
          if (!page) throw notFound('La página');
          const source = await r.publications.findByVersion(pageId, sourceVersion);
          if (!source) throw notFound('La versión');

          // El borrador vuelve a coincidir con lo restaurado, para que la siguiente edición parta de ahí.
          const restoredDraft = await r.pages.update(
            { ...page, ...source.snapshot, updatedAt: clock.now() },
            page.revision,
            null,
          );
          return this.createPublication(r, ctx, restoredDraft, source.snapshot, sourceVersion);
        },
      ),
    );
  }

  private async createPublication(
    r: Repositories,
    ctx: RequestContext,
    page: PageSnapshot,
    content: PublishedContent,
    restoredFromVersion?: number,
  ) {
    const { clock, ids } = this.deps;
    const now = clock.now();

    const site = await r.sites.findById(page.siteId);
    if (!site) throw notFound('El sitio');

    // Un medio que no está listo (o está en cuarentena) no puede salir en una página pública.
    const mediaIds = [
      ...BlockValidator.mediaIds(content.blocks),
      ...(content.seo.og_image_media_id ? [content.seo.og_image_media_id] : []),
    ];
    if (mediaIds.length > 0) {
      const found = await r.media.findMany(mediaIds);
      for (const id of mediaIds) {
        const asset = found.find((m) => m.id === id);
        if (!asset) throw notFound(`El medio ${id}`);
        assertUsable(asset);
      }
    }

    const publication: PublicationRecord = newPublication(
      { id: ids.next(), page, content, restoredFromVersion },
      now,
    );
    await r.publications.insert(publication, null);
    await r.pages.markPublished(page.id, publication.version, now);

    // Proyección pública: sitio (tema y navegación vigentes) y página publicada.
    await r.publicWriter.upsertSite(
      {
        slug: site.slug,
        siteId: site.id,
        organizationId: site.organizationId,
        name: site.name,
        locale: site.locale,
        theme: site.theme,
        navigation: site.navigation,
      },
      now,
    );
    await r.publicWriter.upsertPage({
      siteSlug: site.slug,
      path: content.path,
      pageId: page.id,
      publicationId: publication.id,
      version: publication.version,
      title: content.title,
      locale: content.locale,
      blocks: content.blocks,
      seo: content.seo,
      contentHash: publication.contentHash,
      publishedAt: now,
    });

    await recordAudit(r, this.deps, ctx, {
      organizationId: page.organizationId,
      action: restoredFromVersion ? 'page.restored' : 'page.published',
      target: { type: 'page', id: page.id },
      outcome: 'success',
      metadata: {
        version: publication.version,
        ...(restoredFromVersion ? { from: restoredFromVersion } : {}),
      },
    });
    await r.outbox.append(
      buildEnvelope(
        {
          topic: 'content.page.published.v1',
          producer: 'content',
          organizationId: page.organizationId,
          aggregate: { type: 'page', id: page.id, version: publication.version },
          actor: ctx.actor,
          occurredAt: now,
          data: {
            site_id: site.id,
            page_id: page.id,
            publication_id: publication.id,
            path: content.path,
            locale: content.locale,
            content_hash: publication.contentHash,
          },
        },
        { ids, clock },
      ),
    );
    return toPublicationDto(publication);
  }
}
