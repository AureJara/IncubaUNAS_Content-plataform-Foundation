// Datos que necesitan los bloques de eventos. Los bloques guardan un filtro o un ID, nunca una copia de los eventos
// (PF-037): se leen de la Public Read API en cada render cacheado.
import type { PublicComponents } from '@incuba/api-client';
import type { PublicApi } from './api.server.ts';
import { upstreamError } from './api.server.ts';
import type { BlockData } from './components/blocks.tsx';
import { toEventCard, type EventCard } from './events.ts';
import type { ResolvedSite } from './site.server.ts';

type Block = PublicComponents['schemas']['Block'];
type Catalog = PublicComponents['schemas']['event_catalog.v1'];
type Featured = PublicComponents['schemas']['featured_event.v1'];

/** El contrato permite hasta 100 por página; el destacado se busca entre los próximos. */
const FEATURED_WINDOW = 100;

interface Loaded<T> {
  value: T;
  response: Response;
}

async function listEvents(
  api: PublicApi,
  site: ResolvedSite,
  query: NonNullable<PublicComponents['schemas']['event_catalog.v1']['data']['filter']> & { limit: number },
  signal: AbortSignal,
): Promise<Loaded<EventCard[]>> {
  const { data, response } = await api.GET('/public/v1/sites/{slug}/events', {
    params: { path: { slug: site.slug }, query },
    signal,
  });
  if (!data) upstreamError(response);
  return { value: data.items.map((event) => toEventCard(event, site.locale)), response };
}

async function catalogs(api: PublicApi, site: ResolvedSite, blocks: Catalog[], signal: AbortSignal) {
  return Promise.all(
    blocks.map(async (block) => ({
      id: block.id,
      ...(await listEvents(api, site, { ...block.data.filter, limit: block.data.limit }, signal)),
    })),
  );
}

async function featured(api: PublicApi, site: ResolvedSite, blocks: Featured[], signal: AbortSignal) {
  if (blocks.length === 0) return [];
  const { data, response } = await api.GET('/public/v1/sites/{slug}/events', {
    params: { path: { slug: site.slug }, query: { limit: FEATURED_WINDOW } },
    signal,
  });
  if (!data) upstreamError(response);
  return blocks.map((block) => {
    const event = data.items.find((item) => item.event_id === block.data.event_id);
    return { id: block.id, value: event ? toEventCard(event, site.locale) : null, response };
  });
}

export async function loadBlockData(
  api: PublicApi,
  site: ResolvedSite,
  blocks: readonly Block[],
  signal: AbortSignal,
): Promise<{ data: BlockData; responses: Response[] }> {
  const catalogBlocks = blocks.filter((block): block is Catalog => block.type === 'event_catalog');
  const featuredBlocks = blocks.filter((block): block is Featured => block.type === 'featured_event');
  const [catalogResults, featuredResults] = await Promise.all([
    catalogs(api, site, catalogBlocks, signal),
    featured(api, site, featuredBlocks, signal),
  ]);
  return {
    data: {
      catalogs: Object.fromEntries(catalogResults.map((entry) => [entry.id, entry.value])),
      featured: Object.fromEntries(featuredResults.map((entry) => [entry.id, entry.value])),
    },
    responses: [...catalogResults, ...featuredResults].map((entry) => entry.response),
  };
}
