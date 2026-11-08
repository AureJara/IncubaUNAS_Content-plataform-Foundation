// Página publicada del sitio, incluida la portada. Lee el snapshot de la publicación vigente (PF-038).
import { data } from 'react-router';
import { publicApi, upstreamError } from '../api.server.ts';
import { loadBlockData } from '../blocks.server.ts';
import { cacheHeaders, routeHeaders } from '../cache.ts';
import { Blocks } from '../components/blocks.tsx';
import { siteContext } from '../site.server.ts';
import type { Route } from './+types/page';

// PagePath del contrato: minúsculas, `/` es la portada.
const PAGE_PATH = /^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/u;

export function pagePath(splat: string | undefined): string | null {
  const path = `/${(splat ?? '').replace(/\/+$/u, '')}`;
  return PAGE_PATH.test(path) ? path : null;
}

export async function loader({ params, context, request }: Route.LoaderArgs) {
  const path = pagePath(params['*']);
  if (!path) throw data(null, { status: 404 });
  const site = context.get(siteContext);
  const api = publicApi(context);
  const { data: page, response } = await api.GET('/public/v1/sites/{slug}/pages/{path}', {
    params: { path: { slug: site.slug, path }, query: { locale: site.locale } },
    signal: request.signal,
  });
  if (!page) upstreamError(response);
  const blocks = await loadBlockData(api, site, page.blocks, request.signal);
  return data(
    { page, blocks: blocks.data },
    { headers: cacheHeaders([response, ...blocks.responses], [site.surrogateKey]) },
  );
}

export const headers: Route.HeadersFunction = (args) => routeHeaders(args);

export const meta: Route.MetaFunction = ({ loaderData, matches }) => {
  if (!loaderData) return [{ title: 'Página no encontrada' }];
  const { page } = loaderData;
  const siteName = matches[0].loaderData?.site.name;
  const title = page.seo.title ?? page.title;
  const tags: Route.MetaDescriptors = [{ title: siteName && title !== siteName ? `${title} · ${siteName}` : title }];
  if (page.seo.description) tags.push({ name: 'description', content: page.seo.description });
  if (page.seo.canonical) tags.push({ tagName: 'link', rel: 'canonical', href: page.seo.canonical });
  return tags;
};

export default function Page({ loaderData }: Route.ComponentProps) {
  const { page, blocks } = loaderData;
  const startsWithHero = page.blocks[0]?.type === 'hero';
  return (
    <div className="space-y-12">
      {!startsWithHero && <h1 className="font-headline-lg text-headline-lg text-on-surface">{page.title}</h1>}
      <Blocks blocks={page.blocks} data={blocks} />
    </div>
  );
}
