import {
  clampLimit,
  decodeCursor,
  encodeCursor,
  notFound,
  sha256Hex,
  toPage,
} from '@incubaunas/shared-kernel';
import type { ContentDeps } from './deps.js';
import {
  toPublicEventDto,
  toPublicEventSummaryDto,
  toPublicPageDto,
  toPublicSiteDto,
  toPageDto,
} from './dto.js';
import { parseDraftToken } from './preview.js';

/**
 * Lecturas públicas (PF-042): solo consultan el modelo de lectura ya publicado. Nunca llegan a
 * Event Configuration ni a Participation, así que una visita normal no toca el núcleo transaccional.
 */
export class PublicReadService {
  constructor(private readonly deps: ContentDeps) {}

  async getSite(slug: string, locale?: string) {
    const found = await this.deps.reader.getSite(slug);
    if (!found || (locale && found.site.locale !== locale)) throw notFound('El sitio');
    return { dto: toPublicSiteDto(found.site, found.pages), siteId: found.site.siteId };
  }

  async getPage(slug: string, path: string, locale?: string) {
    const row = await this.deps.reader.getPage(slug, normalizePath(path));
    if (!row || (locale && row.locale !== locale)) throw notFound('La página');
    return toPublicPageDto(row);
  }

  async listEvents(
    slug: string,
    input: { kind?: string; from?: string; to?: string; limit?: number; cursor?: string },
  ) {
    const limit = clampLimit(input.limit);
    const after = decodeCursor<{ startsAt: string; id: string }>(input.cursor);
    const rows = await this.deps.reader.listEvents(
      slug,
      {
        kind: input.kind,
        from: input.from ? new Date(input.from) : undefined,
        to: input.to ? new Date(input.to) : undefined,
      },
      limit + 1,
      after,
    );
    if (rows === null) throw notFound('El sitio');

    const page = toPage(rows, limit, (e) =>
      encodeCursor({ startsAt: e.startsAt.toISOString(), id: e.eventId }),
    );
    return { items: page.items.map(toPublicEventSummaryDto), next_cursor: page.next_cursor };
  }

  async getEvent(slug: string, eventSlug: string) {
    const event = await this.deps.reader.getEvent(slug, eventSlug);
    if (!event) throw notFound('El evento');
    return toPublicEventDto(event);
  }

  /** Consume el token de vista previa (un solo uso) y devuelve el borrador. La respuesta es `no-store`. */
  async consumePreview(token: string) {
    const { organizationId, secret } = parseDraftToken(token);
    const { uow, clock } = this.deps;

    return uow.run({ organizationId }, async (r) => {
      const consumed = await r.previewTokens.consume(sha256Hex(secret), clock.now());
      if (!consumed) throw notFound('La vista previa');
      const page = await r.pages.findById(consumed.pageId);
      if (!page) throw notFound('La vista previa');
      return toPageDto(page);
    });
  }
}

/** `/` es la raíz; el resto se normaliza sin barra final. */
export function normalizePath(path: string): string {
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
