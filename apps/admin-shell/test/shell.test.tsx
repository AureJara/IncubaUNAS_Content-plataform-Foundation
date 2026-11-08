// @vitest-environment jsdom
// Rutas reales del shell con un `fetch` falso (FE-09): sesión, permisos por capability y errores.
import type { CmsComponents } from '@incuba/api-client';
import { cleanup, configure, render, screen, within } from '@testing-library/react';
import { createRoutesStub, RouterContextProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { apiContext, createApi } from '../src/api.ts';
import { routes } from '../src/routes.tsx';
import { loadSession, type Me } from '../src/session.ts';

const ME: Me = {
  user_id: '0b4f3c1e-7a52-4d8e-9c1a-2f6b8d0e4a11',
  display_name: 'Editora de prueba',
  active_organization: {
    id: '5d2e8a90-3b7c-4f1d-8e6a-9c0b1d2e3f40',
    slug: 'incubaunas-demo',
    display_name: 'IncubaUNAS Demo',
  },
  membership_id: '7e1a2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b',
  roles: ['site_editor'],
  capabilities: ['sites:write', 'sites:publish'],
  amr: ['otp'],
  auth_time: '2026-11-08T12:00:00Z',
};

const SITES: CmsComponents['schemas']['SiteCollection'] = {
  items: [
    {
      id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
      slug: 'incubaunas',
      name: 'Sitio de IncubaUNAS',
      kind: 'product',
      locale: 'es-PE',
      state: 'live',
      updated_at: '2026-11-01T15:00:00Z',
    },
  ],
  next_cursor: null,
};

type Handler = (request: Request) => Response;

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json', ...headers },
  });
}

function setup(path: string, overrides: Record<string, Handler> = {}) {
  const calls: string[] = [];
  const handlers: Record<string, Handler> = {
    '/platform/v1/me': () => json(ME, 200, { 'x-mock': 'example' }),
    '/cms/v1/sites': () => json(SITES),
    ...overrides,
  };
  const fetch = async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);
    calls.push(pathname);
    const handler = handlers[pathname];
    return handler ? handler(request) : json({ status: 404 }, 404);
  };
  const context = new RouterContextProvider();
  context.set(apiContext, createApi('http://shell.test', fetch));
  const Stub = createRoutesStub(routes, context);
  render(<Stub initialEntries={[path]} />);
  return { calls };
}

const withCapabilities =
  (capabilities: string[]): Handler =>
  () =>
    json({ ...ME, capabilities }, 200);

// Con todas las suites en paralelo, cargar la sesión puede tardar más que el segundo por defecto.
configure({ asyncUtilTimeout: 5_000 });
afterEach(cleanup);

describe('admin-shell', () => {
  it('entra a la organización activa con el marco del diseño', async () => {
    setup('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Panel principal' })).toBeTruthy();
    // Menú lateral y menú móvil.
    for (const nav of screen.getAllByRole('navigation', { name: 'Menú principal' })) {
      expect(within(nav).getByRole('link', { name: 'Sitios web' })).toBeTruthy();
      expect(within(nav).getByRole('link', { name: 'Mis convocatorias' })).toBeTruthy();
    }
    expect(screen.getByText('Datos de prueba')).toBeTruthy();
    expect(screen.getAllByText('Editora de prueba').length).toBeGreaterThan(0);
  });

  it('lista los sitios cuando la sesión tiene sites:write', async () => {
    setup('/o/incubaunas-demo/sitios');
    expect(await screen.findByText('Sitio de IncubaUNAS')).toBeTruthy();
    expect(screen.getByText('Publicado')).toBeTruthy();
  });

  it('sin sites:write oculta el ítem y no llama a la API de sitios', async () => {
    const { calls } = setup('/o/incubaunas-demo/sitios', { '/platform/v1/me': withCapabilities(['events:read']) });
    expect(await screen.findByRole('heading', { name: 'Sin acceso' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Sitios web' })).toBeNull();
    expect(calls).not.toContain('/cms/v1/sites');
  });

  it('no muestra datos de prueba cuando la API responde de verdad', async () => {
    setup('/o/incubaunas-demo', { '/platform/v1/me': () => json(ME) });
    await screen.findByRole('heading', { level: 1, name: 'Panel principal' });
    expect(screen.queryByText('Datos de prueba')).toBeNull();
  });

  it('responde 404 para otra organización', async () => {
    setup('/o/otra-organizacion');
    expect(await screen.findByRole('heading', { name: 'No encontrado' })).toBeTruthy();
  });

  it('abre un módulo pendiente y responde 404 para uno desconocido', async () => {
    setup('/o/incubaunas-demo/modulos/postulantes');
    expect(await screen.findByRole('heading', { level: 1, name: 'Postulantes' })).toBeTruthy();
    expect(screen.getByText('Equipo 3 · Inscripciones')).toBeTruthy();
    cleanup();
    setup('/o/incubaunas-demo/modulos/no-existe');
    expect(await screen.findByRole('heading', { name: 'No encontrado' })).toBeTruthy();
  });

  it('muestra el request_id del Problem Details sin detalles internos', async () => {
    const problem = {
      type: 'about:blank',
      title: 'Error interno',
      status: 500,
      code: 'internal',
      detail: 'stack interno que no debe verse',
      request_id: 'req-123',
    };
    setup('/', { '/platform/v1/me': () => json(problem, 500) });
    expect(await screen.findByRole('heading', { name: 'Algo salió mal' })).toBeTruthy();
    expect(screen.getByText('req-123')).toBeTruthy();
    expect(screen.queryByText(/stack interno/u)).toBeNull();
  });

  it('sin organización activa lo explica en vez de redirigir', async () => {
    setup('/', { '/platform/v1/me': () => json({ ...ME, active_organization: null, membership_id: null }) });
    expect(await screen.findByRole('heading', { name: 'Sin organización activa' })).toBeTruthy();
  });
});

describe('loadSession', () => {
  it('sin sesión redirige al login del gateway con return_to', async () => {
    const context = new RouterContextProvider();
    context.set(
      apiContext,
      createApi('http://shell.test', async () => json({ status: 401 }, 401)),
    );
    const request = new Request('http://shell.test/o/incubaunas-demo/sitios?vista=lista');
    const thrown = await Promise.resolve(
      loadSession({ request, context, params: {}, url: new URL(request.url), pattern: '' }, async () => undefined),
    ).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(Response);
    const response = thrown as Response;
    expect(response.headers.get('location')).toBe(
      '/auth/login?return_to=%2Fo%2Fincubaunas-demo%2Fsitios%3Fvista%3Dlista',
    );
    expect(response.headers.get('x-remix-reload-document')).toBe('true');
  });
});
