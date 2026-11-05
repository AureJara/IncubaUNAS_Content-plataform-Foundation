import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, friendlyMessage } from '../src/api/client';
import { AuthContext, type AuthContextValue } from '../src/auth/AuthProvider';
import { AppRoutes } from '../src/App';
import type { Capabilities, Me, Scope } from '../src/api/client';

const ORG = '0192f3a0-0000-7000-8000-0000000000a1';
const MEMBERSHIPS = `GET /platform/v1/organizations/${ORG}/memberships`;

const me: Me = {
  user_id: ORG,
  display_name: 'Ana Torres',
  email: 'ana@example.test',
  roles: ['site_editor'],
  scopes: [],
  amr: ['pwd'],
  auth_time: '2026-11-04T12:00:00Z',
  active_organization_id: ORG,
};

function authValue(scopes: Scope[], overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const capabilities: Capabilities = {
    organization_id: ORG,
    roles: ['site_editor'],
    scopes,
    restrictions: [],
    recent_authentication: false,
  };
  return {
    state: { status: 'authenticated', me, capabilities },
    reload: async () => undefined,
    logout: async () => undefined,
    switchOrganization: async () => undefined,
    can: (scope) => !scope || scopes.includes(scope),
    ...overrides,
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });

function mockFetch(routes: Record<string, () => Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const handler = routes[`${init.method ?? 'GET'} ${url}`];
    if (!handler) throw new Error(`Sin mock para ${init.method ?? 'GET'} ${url}`);
    return handler();
  });
  return calls;
}

function renderApp(value: AuthContextValue, path = '/') {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  // jsdom no acepta cookies con prefijo __Host- sobre http; se simula la lectura de la cookie de CSRF.
  vi.spyOn(document, 'cookie', 'get').mockReturnValue('__Host-csrf=token-de-prueba');
  mockFetch({ 'GET /platform/v1/me/organizations': () => json({ items: [], next_cursor: null }) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('navegación por permisos', () => {
  it('muestra solo los módulos cuyo scope tiene el usuario', async () => {
    renderApp(authValue([]));
    expect(await screen.findByRole('link', { name: 'Mis sesiones' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Miembros' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Auditoría' })).not.toBeInTheDocument();
  });

  it('un administrador ve los módulos de administración', async () => {
    renderApp(authValue(['organizations:admin']));
    expect(await screen.findByRole('link', { name: 'Miembros' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Auditoría' })).toBeInTheDocument();
  });

  it('entrar por URL a un módulo sin permiso muestra "sin acceso", no la pantalla', async () => {
    renderApp(authValue([]), '/miembros');
    expect(await screen.findByRole('alert')).toHaveTextContent(/no tienes permiso/i);
    expect(screen.queryByRole('heading', { name: 'Miembros' })).not.toBeInTheDocument();
  });

  it('una ruta inexistente muestra 404 dentro del marco', async () => {
    renderApp(authValue([]), '/no-existe');
    expect(
      await screen.findByRole('heading', { name: 'Página no encontrada' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
  });
});

describe('estados de la sesión', () => {
  it('sin sesión ofrece iniciar sesión con retorno a la página actual', () => {
    renderApp({ ...authValue([]), state: { status: 'anonymous' } });
    const link = screen.getByRole('link', { name: 'Iniciar sesión' });
    expect(link.getAttribute('href')).toMatch(/^\/auth\/login\?return_to=/);
  });

  it('mientras carga anuncia el estado a los lectores de pantalla', () => {
    renderApp({ ...authValue([]), state: { status: 'loading' } });
    expect(screen.getByRole('status')).toHaveTextContent(/cargando/i);
  });

  it('un error de red muestra un mensaje, no una pantalla en blanco', () => {
    renderApp({
      ...authValue([]),
      state: { status: 'error', error: new ApiError(500, 'internal_error', 'falló', 'req-9') },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/req-9/);
  });
});

describe('módulo de miembros', () => {
  const member = {
    id: 'm-1',
    organization_id: ORG,
    user_id: 'u-1',
    email: 'ana@example.test',
    display_name: 'Ana Torres',
    state: 'active',
    roles: ['org_owner'],
    restrictions: [],
    revision: 3,
    created_at: '2026-11-04T12:00:00Z',
    updated_at: '2026-11-04T12:00:00Z',
  };

  it('lista los miembros y explica con claridad que no se puede dejar sin owner', async () => {
    const calls = mockFetch({
      [MEMBERSHIPS]: () => json({ items: [member], next_cursor: null }),
      'GET /platform/v1/me/organizations': () => json({ items: [], next_cursor: null }),
      'PATCH /platform/v1/memberships/m-1': () =>
        json(
          {
            code: 'last_owner_required',
            detail: 'x',
            status: 409,
            type: 't',
            title: 'Conflict',
            request_id: 'r',
          },
          409,
        ),
    });
    renderApp(authValue(['organizations:admin']), '/miembros');

    expect(await screen.findByText('Ana Torres')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Suspender' }));

    expect(await screen.findByText(/al menos un owner activo/i)).toBeInTheDocument();
    const patch = calls.find((c) => c.init.method === 'PATCH')!;
    expect((patch.init.headers as Record<string, string>)['if-match']).toBe('"3"');
  });

  it('muestra un estado vacío cuando no hay miembros', async () => {
    mockFetch({
      [MEMBERSHIPS]: () => json({ items: [], next_cursor: null }),
      'GET /platform/v1/me/organizations': () => json({ items: [], next_cursor: null }),
    });
    renderApp(authValue(['organizations:admin']), '/miembros');
    expect(await screen.findByText(/aún no hay miembros/i)).toBeInTheDocument();
  });

  it('un 403 de la API se muestra como falta de permiso, sin ofrecer reintento', async () => {
    mockFetch({
      [MEMBERSHIPS]: () =>
        json(
          {
            code: 'forbidden',
            detail: 'no',
            status: 403,
            type: 't',
            title: 'Forbidden',
            request_id: 'r',
          },
          403,
        ),
      'GET /platform/v1/me/organizations': () => json({ items: [], next_cursor: null }),
    });
    renderApp(authValue(['organizations:admin']), '/miembros');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no tienes permiso/i));
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });
});

describe('cliente de API', () => {
  it('envía CSRF e Idempotency-Key en un POST, y If-Match en un PATCH, pero nada de eso en un GET', async () => {
    const calls = mockFetch({
      'POST /x': () => json({}),
      'PATCH /x': () => json({}),
      'GET /x': () => json({}),
    });
    await api('/x', { method: 'POST', body: { a: 1 } });
    await api('/x', { method: 'PATCH', body: { a: 1 }, ifMatch: 7 });
    await api('/x');

    type Headers = Record<string, string>;
    const [post, patch, get] = calls.map((c) => c.init.headers as Headers) as [
      Headers,
      Headers,
      Headers,
    ];
    expect(post['x-csrf-token']).toBe('token-de-prueba');
    expect(post['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(patch['if-match']).toBe('"7"');
    expect(patch['content-type']).toBe('application/merge-patch+json');
    expect(patch['idempotency-key']).toBeUndefined();
    expect(get['x-csrf-token']).toBeUndefined();
    expect(calls.every((c) => c.init.credentials === 'same-origin')).toBe(true);
  });

  it('traduce Problem Details a un error con código estable', async () => {
    mockFetch({
      'GET /y': () =>
        json(
          {
            code: 'stale_revision',
            detail: 'x',
            status: 412,
            type: 't',
            title: 'T',
            request_id: 'req-1',
          },
          412,
        ),
    });
    await expect(api('/y')).rejects.toMatchObject({
      status: 412,
      code: 'stale_revision',
      requestId: 'req-1',
    });
    expect(friendlyMessage(new ApiError(412, 'stale_revision', 'x'))).toMatch(/recarga/i);
    expect(friendlyMessage(new Error('boom'))).toMatch(/conexión/i);
  });
});
