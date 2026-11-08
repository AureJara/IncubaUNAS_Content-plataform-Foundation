// Resolución del sitio por host (PF-040): el middleware de la raíz la guarda en el contexto para los loaders.
import { createContext, type MiddlewareFunction } from 'react-router';
import { publicApi, upstreamError } from './api.server.ts';

export interface ResolvedSite {
  slug: string;
  locale: string;
  /** Surrogate-Key de la resolución, para purgar por sitio (FE-05). */
  surrogateKey: string | null;
}

export const siteContext = createContext<ResolvedSite>();

export const resolveSite: MiddlewareFunction<Response> = async ({ request, context }) => {
  const host = new URL(request.url).hostname;
  const { data: resolution, response } = await publicApi(context).GET('/public/v1/site-resolutions', {
    params: { query: { host } },
    signal: request.signal,
  });
  if (!resolution) upstreamError(response);
  context.set(siteContext, {
    slug: resolution.slug,
    locale: resolution.locale,
    surrogateKey: response.headers.get('surrogate-key'),
  });
};
