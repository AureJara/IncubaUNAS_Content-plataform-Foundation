import {
  clampLimit,
  decodeCursor,
  encodeCursor,
  notFound,
  sha256Hex,
  staleRevision,
  toPage,
  validationFailed,
  type Page,
  type Uuid,
} from '@incubaunas/shared-kernel';
import { runIdempotent } from '@incubaunas/service-kit';
import type { RequestContext } from '@incubaunas/tenancy';
import type { Block } from '../domain/blocks.js';
import type { PageSnapshot, Seo } from '../domain/page.js';
import {
  applySitePatch,
  newSite,
  type NavigationItem,
  type SiteKind,
  type ThemeTokens,
} from '../domain/site.js';
import { ownTenant, recordAudit, type ContentDeps } from './deps.js';
import { toPageDto, toSiteDto } from './dto.js';

export interface SiteCreateInput {
  slug: string;
  name: string;
  kind: SiteKind;
  locale: string;
}

export interface SitePatchInput {
  name?: string;
  locale?: string;
  theme?: ThemeTokens;
  navigation?: NavigationItem[];
}

export interface PageCreateInput {
  path: string;
  title: string;
  blocks?: { type: string; props: Record<string, unknown> }[];
  seo?: Seo;
}

export interface PagePatchInput {
  title?: string;
  blocks?: { type: string; props: Record<string, unknown> }[];
  seo?: Seo;
}

export class SiteService {
  constructor(private readonly deps: ContentDeps) {}

  async list(
    ctx: RequestContext,
    input: { limit?: number; cursor?: string },
  ): Promise<Page<ReturnType<typeof toSiteDto>>> {
    ctx.authz.require('sites:write');
    const organizationId = ownTenant(ctx);
    const limit = clampLimit(input.limit);
    const after = decodeCursor<{ createdAt: string; id: string }>(input.cursor);

    return this.deps.uow.run({ organizationId }, async (r) => {
      const page = toPage(await r.sites.list(limit + 1, after), limit, (s) =>
        encodeCursor({ createdAt: s.createdAt.toISOString(), id: s.id }),
      );
      return { items: page.items.map(toSiteDto), next_cursor: page.next_cursor };
    });
  }

  async create(ctx: RequestContext, input: SiteCreateInput, key: string) {
    ctx.authz.require('sites:write');
    const organizationId = ownTenant(ctx);
    const { uow, clock, ids } = this.deps;

    return uow.run({ organizationId }, (r) =>
      runIdempotent(
        r.idempotency,
        clock,
        { organizationId, actorId: ctx.actor.id, operation: 'site.create' },
        key,
        input,
        async () => {
          const site = newSite({ id: ids.next(), organizationId, ...input }, clock.now());
          await r.sites.insert(site, null);
          await recordAudit(r, this.deps, ctx, {
            organizationId,
            action: 'site.created',
            target: { type: 'site', id: site.id },
            outcome: 'success',
            metadata: { slug: site.slug },
          });
          return toSiteDto(site);
        },
      ),
    );
  }

  async get(ctx: RequestContext, siteId: Uuid) {
    ctx.authz.require('sites:write');
    const organizationId = ownTenant(ctx);
    return this.deps.uow.run({ organizationId }, async (r) => {
      const site = await r.sites.findById(siteId);
      if (!site) throw notFound('El sitio');
      return toSiteDto(site);
    });
  }

  /** El tema y la navegación se validan (contraste y enlaces) y, si el sitio ya es público, se reflejan en su proyección. */
  async update(ctx: RequestContext, siteId: Uuid, patch: SitePatchInput, expectedRevision: number) {
    ctx.authz.require('sites:write');
    const organizationId = ownTenant(ctx);
    const { uow, clock } = this.deps;

    return uow.run({ organizationId }, async (r) => {
      const current = await r.sites.findById(siteId);
      if (!current) throw notFound('El sitio');
      if (current.revision !== expectedRevision) throw staleRevision();

      const saved = await r.sites.update(
        applySitePatch(current, patch, clock.now()),
        expectedRevision,
        null,
      );
      if (await r.publicWriter.siteIsPublished(siteId)) {
        await r.publicWriter.upsertSite(
          {
            slug: saved.slug,
            siteId,
            organizationId,
            name: saved.name,
            locale: saved.locale,
            theme: saved.theme,
            navigation: saved.navigation,
          },
          clock.now(),
        );
      }
      await recordAudit(r, this.deps, ctx, {
        organizationId,
        action: 'site.updated',
        target: { type: 'site', id: siteId },
        outcome: 'success',
        metadata: { fields: Object.keys(patch).sort().join(',') },
      });
      return toSiteDto(saved);
    });
  }
}

export class PageService {
  constructor(private readonly deps: ContentDeps) {}

  async list(
    ctx: RequestContext,
    siteId: Uuid,
    input: { limit?: number; cursor?: string },
  ): Promise<Page<ReturnType<typeof toPageDto>>> {
    ctx.authz.require('sites:write');
    const organizationId = ownTenant(ctx);
    const limit = clampLimit(input.limit);
    const after = decodeCursor<{ createdAt: string; id: string }>(input.cursor);

    return this.deps.uow.run({ organizationId }, async (r) => {
      if (!(await r.sites.findById(siteId))) throw notFound('El sitio');
      const page = toPage(await r.pages.list(siteId, limit + 1, after), limit, (p) =>
        encodeCursor({ createdAt: p.createdAt.toISOString(), id: p.id }),
      );
      return { items: page.items.map(toPageDto), next_cursor: page.next_cursor };
    });
  }

  async create(ctx: RequestContext, siteId: Uuid, input: PageCreateInput, key: string) {
    ctx.authz.require('sites:write');
    const organizationId = ownTenant(ctx);
    const { uow, clock, ids, blocks } = this.deps;

    return uow.run({ organizationId }, (r) =>
      runIdempotent(
        r.idempotency,
        clock,
        { organizationId, actorId: ctx.actor.id, operation: 'page.create' },
        key,
        { siteId, ...input },
        async () => {
          const site = await r.sites.findById(siteId);
          if (!site) throw notFound('El sitio');
          const now = clock.now();
          const page: PageSnapshot = {
            id: ids.next(),
            organizationId,
            siteId,
            path: input.path,
            title: input.title.trim(),
            locale: site.locale,
            blocks: blocks.validate(input.blocks ?? []),
            seo: input.seo ?? {},
            publishedVersion: null,
            revision: 1,
            createdAt: now,
            updatedAt: now,
          };
          await r.pages.insert(page, null);
          await recordAudit(r, this.deps, ctx, {
            organizationId,
            action: 'page.created',
            target: { type: 'page', id: page.id },
            outcome: 'success',
            metadata: { path: page.path },
          });
          return toPageDto(page);
        },
      ),
    );
  }

  async get(ctx: RequestContext, pageId: Uuid) {
    ctx.authz.require('sites:write');
    const organizationId = ownTenant(ctx);
    return this.deps.uow.run({ organizationId }, async (r) => {
      const page = await r.pages.findById(pageId);
      if (!page) throw notFound('La página');
      return toPageDto(page);
    });
  }

  async update(ctx: RequestContext, pageId: Uuid, patch: PagePatchInput, expectedRevision: number) {
    ctx.authz.require('sites:write');
    const organizationId = ownTenant(ctx);
    const { uow, clock, blocks } = this.deps;

    return uow.run({ organizationId }, async (r) => {
      const current = await r.pages.findById(pageId);
      if (!current) throw notFound('La página');
      if (current.revision !== expectedRevision) throw staleRevision();

      const next: PageSnapshot = {
        ...current,
        title: patch.title?.trim() ?? current.title,
        blocks: patch.blocks ? (blocks.validate(patch.blocks) as Block[]) : current.blocks,
        seo: patch.seo ?? current.seo,
        updatedAt: clock.now(),
      };
      const saved = await r.pages.update(next, expectedRevision, null);
      await recordAudit(r, this.deps, ctx, {
        organizationId,
        action: 'page.updated',
        target: { type: 'page', id: pageId },
        outcome: 'success',
      });
      return toPageDto(saved);
    });
  }

  /** Vista previa: token corto de un solo uso; la organización va delante para fijar el tenant al consumirlo. */
  async createPreviewToken(ctx: RequestContext, pageId: Uuid, ttlSeconds: number) {
    ctx.authz.require('sites:write');
    const organizationId = ownTenant(ctx);
    const { uow, clock, ids, tokens, previewBaseUrl } = this.deps;
    if (ttlSeconds < 30 || ttlSeconds > 900) {
      throw validationFailed('La vigencia no es válida.', [
        { pointer: '/ttl_seconds', code: 'range', message: 'Entre 30 y 900 segundos.' },
      ]);
    }
    const secret = tokens.generate();
    const now = clock.now();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    return uow.run({ organizationId }, async (r) => {
      if (!(await r.pages.findById(pageId))) throw notFound('La página');
      await r.previewTokens.insert({
        id: ids.next(),
        organizationId,
        pageId,
        tokenHash: sha256Hex(secret),
        expiresAt,
        createdBy: null,
        createdAt: now,
      });
      await recordAudit(r, this.deps, ctx, {
        organizationId,
        action: 'page.preview_created',
        target: { type: 'page', id: pageId },
        outcome: 'success',
      });
      return {
        preview_url: `${previewBaseUrl}/preview/${organizationId}.${secret}`,
        expires_at: expiresAt.toISOString(),
      };
    });
  }
}
