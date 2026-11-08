// Raíz del sitio público: resuelve el sitio por host, lee su navegación y pinta el marco (PF-040, PF-041).
import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';
import type { ReactNode } from 'react';
import { publicApi, upstreamError } from './api.server.ts';
import { cacheHeaders, routeHeaders } from './cache.ts';
import { DemoBanner, SiteFooter, SiteHeader } from './components/site-chrome.tsx';
import { resolveSite, siteContext } from './site.server.ts';
import type { Route } from './+types/root';
import './app.css';

export const middleware: Route.MiddlewareFunction[] = [resolveSite];

export async function loader({ context, request }: Route.LoaderArgs) {
  const resolved = context.get(siteContext);
  const { data: site, response } = await publicApi(context).GET('/public/v1/sites/{slug}', {
    params: { path: { slug: resolved.slug } },
    signal: request.signal,
  });
  if (!site) upstreamError(response);
  return data({ site }, { headers: cacheHeaders([response], [resolved.surrogateKey]) });
}

export const headers: Route.HeadersFunction = (args) => routeHeaders(args);

export function Layout({ children }: { children: ReactNode }) {
  const loaderData = useRouteLoaderData<typeof loader>('root');
  return (
    <html lang={loaderData?.site.locale ?? 'es-PE'}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
        >
          Saltar al contenido
        </a>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { site } = loaderData;
  return (
    <div className="flex min-h-screen flex-col">
      {site.kind === 'demo' && <DemoBanner />}
      <SiteHeader site={site} />
      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-grow px-4 py-10 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <SiteFooter name={site.name} />
    </div>
  );
}

/** Sin trazas ni detalles internos (SEC-11). */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main id="contenido" className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-12">
      <div className="w-full space-y-3 rounded-xl border border-surface-container-highest bg-surface-container-lowest p-8 shadow-sm">
        <h1 className="font-headline-md text-headline-md text-on-surface">
          {notFound ? 'Página no encontrada' : 'El sitio no está disponible'}
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          {notFound
            ? 'La página que buscas no existe o ya no está publicada.'
            : 'Tuvimos un problema al cargar esta página. Vuelve a intentarlo en unos minutos.'}
        </p>
        <a href="/" className="inline-block font-label-lg text-label-lg text-primary hover:underline">
          Ir al inicio
        </a>
      </div>
    </main>
  );
}
