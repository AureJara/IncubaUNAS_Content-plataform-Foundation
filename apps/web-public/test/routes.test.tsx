// @vitest-environment jsdom
// Rutas del sitio público con la Public Read API falsa (FE-09): resolución por host, bloques y errores.
import { createPublicClient, type PublicComponents } from '@incuba/api-client';
import { cleanup, configure, render, screen, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import {
  createRoutesStub,
  Meta,
  RouterContextProvider,
  type LoaderFunction,
  type MetaFunction,
  type MiddlewareFunction,
} from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { publicApiContext } from '../app/api.server.ts';
import App, { ErrorBoundary, loader as rootLoader, meta as rootMeta, middleware } from '../app/root.tsx';
import EventPage, { loader as eventLoader, meta as eventMeta } from '../app/routes/event.tsx';
import Page, { loader as pageLoader, meta as pageMeta } from '../app/routes/page.tsx';

type Schemas = PublicComponents['schemas'];

/**
 * Typegen da a cada módulo tipos más estrictos que los genéricos del stub (params por ruta, respuesta del middleware
 * del servidor). En la prueba se usan las mismas funciones, solo con el tipo del stub.
 */
const loose = <T,>(value: unknown): T => value as T;

/** `<Meta />` vive en el Layout, que el stub no usa: se pinta junto a la raíz para leer el título del documento. */
function withMeta<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  return function WithMeta(props: P) {
    return (
      <>
        <Meta />
        <Component {...props} />
      </>
    );
  };
}

const SITE: Schemas['PublicSite'] = {
  site_id: '018f6b2c-0000-7000-8000-000000000001',
  slug: 'incubaunas',
  name: 'IncubaUNAS',
  kind: 'demo',
  locale: 'es-PE',
  theme: {
    color_primary: '#005bbf',
    color_on_primary: '#ffffff',
    color_background: '#f7fafd',
    color_text: '#181c1e',
    font_family: 'system',
    radius: 'medium',
  },
  navigation: [
    { label: 'Eventos', href: '/eventos' },
    { label: 'Malicioso', href: '//evil.example' },
  ],
};

const EVENT: Schemas['PublicEventSummary'] = {
  event_id: '018f6b2c-0000-7000-8000-0000000000e1',
  publication_id: '018f6b2c-0000-7000-8000-0000000000a1',
  slug: 'feria-agtech',
  title: 'Feria AgTech',
  summary: 'Muestra de emprendimientos.',
  state: 'scheduled',
  modality: 'in_person',
  starts_at: '2026-12-01T14:00:00Z',
  ends_at: '2026-12-01T16:00:00Z',
  timezone: 'America/Lima',
  venue_name: 'Auditorio central',
  registration: { status: 'open', as_of: '2026-11-08T12:00:00Z' },
};

const HOME: Schemas['PublicPage'] = {
  site_id: SITE.site_id,
  page_id: '018f6b2c-0000-7000-8000-0000000000a2',
  publication_id: '018f6b2c-0000-7000-8000-0000000000a3',
  path: '/',
  locale: 'es-PE',
  title: 'Inicio',
  seo: {},
  content_hash: 'sha256:abc',
  published_at: '2026-11-01T12:00:00Z',
  blocks: [
    {
      id: '018f6b2c-0000-7000-8000-0000000000b1',
      type: 'hero',
      version: 1,
      data: { heading: 'Emprende en la Amazonía', cta: { label: 'Ver eventos', href: 'javascript:alert(1)' } },
    },
    {
      id: '018f6b2c-0000-7000-8000-0000000000b2',
      type: 'rich_text',
      version: 1,
      data: {
        nodes: [
          { kind: 'paragraph', spans: [{ text: '<script>alert(1)</script>' }] },
          { kind: 'list_item', spans: [{ text: 'Uno', marks: ['bold'] }] },
          { kind: 'list_item', spans: [{ text: 'Dos', href: '/dos' }] },
        ],
      },
    },
    {
      id: '018f6b2c-0000-7000-8000-0000000000b3',
      type: 'event_catalog',
      version: 1,
      data: { heading: 'Próximos eventos', limit: 3, filter: { modality: 'in_person' } },
    },
  ],
};

type Handler = (url: URL) => Response;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
  });
}

const notFound = () => json({ status: 404 }, 404);

function setup(path: string, overrides: Record<string, Handler> = {}) {
  const requests: URL[] = [];
  const handlers: Record<string, Handler> = {
    '/public/v1/site-resolutions': (url) =>
      // El router en memoria de las pruebas usa el origen http://localhost.
      url.searchParams.get('host') === 'localhost'
        ? json({ site_id: SITE.site_id, slug: SITE.slug, locale: SITE.locale })
        : notFound(),
    '/public/v1/sites/incubaunas': () => json(SITE),
    '/public/v1/sites/incubaunas/pages/%2F': () => json(HOME),
    '/public/v1/sites/incubaunas/events': () => json({ items: [EVENT], next_cursor: null }),
    '/public/v1/sites/incubaunas/events/feria-agtech': () =>
      json({
        ...EVENT,
        description: ['Primer párrafo.'],
        sessions: [],
        programs: [{ id: EVENT.event_id, name: 'AgTech' }],
      }),
    ...overrides,
  };
  const fetch = async (request: Request) => {
    const url = new URL(request.url);
    requests.push(url);
    return (handlers[url.pathname] ?? notFound)(url);
  };
  const context = new RouterContextProvider();
  context.set(publicApiContext, createPublicClient({ baseUrl: 'http://public-api.test', fetch }));
  const Stub = createRoutesStub(
    [
      {
        id: 'root',
        path: '/',
        middleware: loose<MiddlewareFunction[]>(middleware),
        loader: rootLoader,
        meta: loose<MetaFunction>(rootMeta),
        Component: withMeta(App),
        ErrorBoundary: withMeta(ErrorBoundary),
        children: [
          {
            path: 'eventos/:eventSlug',
            loader: loose<LoaderFunction>(eventLoader),
            meta: loose<MetaFunction>(eventMeta),
            Component: EventPage,
          },
          { index: true, loader: pageLoader, meta: loose<MetaFunction>(pageMeta), Component: Page },
          { path: '*', loader: pageLoader, meta: loose<MetaFunction>(pageMeta), Component: Page },
        ],
      },
    ],
    context,
  );
  render(<Stub initialEntries={[path]} />);
  return { requests };
}

// Con todas las suites en paralelo, cargar la sesión puede tardar más que el segundo por defecto.
configure({ asyncUtilTimeout: 5_000 });
afterEach(cleanup);

describe('web-public', () => {
  it('pinta la portada con sus bloques, sin HTML crudo ni enlaces peligrosos', async () => {
    const { requests } = setup('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Emprende en la Amazonía' })).toBeTruthy();
    expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Ver eventos/u })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Malicioso' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Eventos' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Dos' }).getAttribute('href')).toBe('/dos');
    expect(screen.getByText('Sitio de demostración: el contenido es de ejemplo.')).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'Feria AgTech' })).toBeTruthy();
    const events = requests.find((url) => url.pathname.endsWith('/events'));
    expect(events?.searchParams.get('modality')).toBe('in_person');
    expect(events?.searchParams.get('limit')).toBe('3');
  });

  it('muestra el detalle de un evento', async () => {
    setup('/eventos/feria-agtech');
    expect(await screen.findByRole('heading', { level: 1, name: 'Feria AgTech' })).toBeTruthy();
    expect(screen.getByText('Primer párrafo.')).toBeTruthy();
    expect(screen.getByText('Inscripciones abiertas')).toBeTruthy();
  });

  it('responde 404 para un host sin sitio', async () => {
    const { requests } = setup('/', {
      '/public/v1/site-resolutions': notFound,
    });
    expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeTruthy();
    expect(requests.some((url) => url.pathname.includes('/pages/'))).toBe(false);
  });

  it('responde 404 para una ruta inválida sin llamar a la API de páginas', async () => {
    const { requests } = setup('/Mayusculas');
    expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeTruthy();
    expect(requests.some((url) => url.pathname.includes('/pages/'))).toBe(false);
  });

  it('ante un fallo de la API muestra un error genérico sin detalles internos', async () => {
    setup('/', { '/public/v1/sites/incubaunas': () => json({ detail: 'pool agotado en db-01' }, 500) });
    expect(await screen.findByRole('heading', { name: 'El sitio no está disponible' })).toBeTruthy();
    expect(screen.queryByText(/db-01/u)).toBeNull();
  });
});

describe('título del documento (WCAG 2.4.2)', () => {
  it('una página usa el suyo, con el nombre del sitio', async () => {
    setup('/');
    await waitFor(() => expect(document.title).toBe('Inicio · IncubaUNAS'));
  });

  it('un evento usa su título', async () => {
    setup('/eventos/feria-agtech');
    await waitFor(() => expect(document.title).toBe('Feria AgTech · IncubaUNAS'));
  });

  it('una ruta inválida da 404 con título, no una pestaña sin nombre', async () => {
    setup('/Mayusculas');
    await waitFor(() => expect(document.title).toBe('Página no encontrada · IncubaUNAS'));
  });

  it('un host sin sitio da 404 con título aunque no haya nombre de sitio', async () => {
    setup('/', { '/public/v1/site-resolutions': notFound });
    await waitFor(() => expect(document.title).toBe('Página no encontrada'));
  });

  it('un fallo de la API da un título genérico sin detalles internos', async () => {
    setup('/', { '/public/v1/sites/incubaunas': () => json({ detail: 'pool agotado en db-01' }, 500) });
    await waitFor(() => expect(document.title).toBe('El sitio no está disponible'));
    expect(document.title).not.toMatch(/db-01/u);
  });
});
