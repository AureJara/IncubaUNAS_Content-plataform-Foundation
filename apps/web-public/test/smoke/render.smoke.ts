import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Prueba de humo del sitio ya compilado (`astro build`): levanta `dist/server/entry.mjs` contra una Content API
 * simulada y mira lo que el navegador recibiría. Cubre lo que las pruebas unitarias no ven: la CSP real, que no
 * queden scripts en línea ni fuentes `data:` (la CSP los bloquearía y el menú móvil dejaría de funcionar), y que
 * cada página renderice con datos y degrade bien cuando la API falla.
 */

const SLUG = 'demo';
const EVENT = {
  slug: 'congreso-2026',
  title: 'Congreso de Innovación 2026',
  kind: 'congreso',
  starts_at: '2026-12-01T14:00:00.000Z',
  ends_at: '2026-12-03T23:00:00.000Z',
  timezone: 'America/Lima',
  status: 'published',
  registration: { state: 'open', remaining_band: 'few', as_of: '2026-11-04T18:00:00.000Z' },
};
const SITE = {
  slug: SLUG,
  name: 'Sitio de prueba',
  locale: 'es-PE',
  theme: { color_primary: '#aa3300', radius: 'lg' },
  navigation: [
    { label: 'Eventos', href: '/eventos' },
    { label: 'Guía', href: '/guia' },
    { label: 'Trampa', href: 'javascript:alert(1)' },
  ],
  pages: [],
};
const GUIDE = {
  path: '/guia',
  title: 'Guía de prueba',
  locale: 'es-PE',
  seo: {},
  blocks: [
    {
      type: 'hero',
      props: { heading: 'Bienvenida de prueba', cta_label: 'Ver', cta_href: '/eventos' },
    },
    { type: 'rich_text', props: { markdown: 'Texto **claro** <script>alert(1)</script>' } },
    { type: 'event_catalog', props: {} },
    { type: 'faq', props: { items: [{ question: '¿Funciona?', answer: 'Sí.' }] } },
  ],
};

let eventsDown = false;
let api: Server;
let web: ChildProcess;
let base = '';
const ADMIN_URL = 'https://admin.example.test';

function json(body: unknown, status = 200) {
  return { status, body: JSON.stringify(body) };
}

function mockApi(path: string) {
  const prefix = `/public/v1/sites/${SLUG}`;
  if (path === prefix) return json(SITE);
  if (path === `${prefix}/events`)
    return eventsDown ? json({}, 503) : json({ items: [EVENT], next_cursor: null });
  if (path === `${prefix}/events/${EVENT.slug}`)
    return json({
      ...EVENT,
      description: 'Descripción de prueba',
      publication_id: '00000000-0000-7000-8000-000000000001',
      release_version: 1,
      programs: [{ slug: 'ia', name: 'Inteligencia Artificial', color: '#0b5fff' }],
      sessions: [
        {
          id: '00000000-0000-7000-8000-000000000002',
          program_slug: 'ia',
          title: 'Apertura',
          starts_at: '2026-12-01T15:00:00.000Z',
          ends_at: '2026-12-01T16:00:00.000Z',
          venue_name: 'Auditorio',
          speakers: ['Ana'],
        },
      ],
    });
  if (path === `${prefix}/pages/${encodeURIComponent('/guia')}`) return json(GUIDE);
  return json({ title: 'No encontrado' }, 404);
}

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const probe = createNetServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });

async function page(path: string) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual' });
  return { response, html: await response.text() };
}

beforeAll(async () => {
  api = createServer((request, response) => {
    const { status, body } = mockApi(new URL(request.url ?? '/', 'http://x').pathname);
    response.writeHead(status, {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=30',
      'surrogate-key': 'site:demo',
    });
    response.end(body);
  });
  await new Promise<void>((resolve) => api.listen(0, '127.0.0.1', resolve));
  const apiPort = (api.address() as { port: number }).port;

  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  web = spawn(
    process.execPath,
    [join(import.meta.dirname, '..', '..', 'dist', 'server', 'entry.mjs')],
    {
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(port),
        SITE_SLUG: SLUG,
        CONTENT_API_URL: `http://127.0.0.1:${apiPort}`,
        ADMIN_URL,
      },
      stdio: 'ignore',
    },
  );

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${base}/health`)).ok) return;
    } catch {
      /* el servidor aún arranca */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('El sitio compilado no arrancó: ¿corriste `astro build`?');
}, 30_000);

afterAll(async () => {
  web?.kill();
  await new Promise<void>((resolve) => (api ? api.close(() => resolve()) : resolve()));
});

describe('páginas con datos de la Content API', () => {
  it('el inicio mezcla el diseño con los eventos reales', async () => {
    const { response, html } = await page('/');
    expect(response.status).toBe(200);
    expect(html).toContain('Conéctate, Suscríbete y Crea');
    expect(html).toContain('Congreso de Innovación 2026');
    expect(html).toContain('href="/eventos/congreso-2026"');
    expect(response.headers.get('cache-control')).toContain('max-age=30');
    expect(response.headers.get('surrogate-key')).toBe('site:demo');
  });

  it('el catálogo lista los eventos y trae el buscador', async () => {
    const { response, html } = await page('/eventos');
    expect(response.status).toBe(200);
    expect(html).toContain('data-kind="congreso"');
    expect(html).toContain('Inscripciones abiertas');
    expect(html).toContain('Quedan pocos cupos');
    expect(html).toContain('id="event-search"');
  });

  it('el detalle muestra la agenda y deja el espacio de inscripción del Equipo 3', async () => {
    const { response, html } = await page('/eventos/congreso-2026');
    expect(response.status).toBe(200);
    expect(html).toContain('Descripción de prueba');
    expect(html).toContain('Inteligencia Artificial');
    expect(html).toContain('Apertura');
    expect(html).toContain('data-registration-slot');
    expect(html).toContain('data-event-slug="congreso-2026"');
  });

  it('un evento que no existe responde 404 y no se indexa', async () => {
    const { response, html } = await page('/eventos/no-existe');
    expect(response.status).toBe(404);
    expect(html).toContain('noindex');
  });

  it('una página del CMS se renderiza con el diseño y su Markdown va saneado', async () => {
    const { response, html } = await page('/guia');
    expect(response.status).toBe(200);
    expect(html).toContain('Bienvenida de prueba');
    expect(html).toContain('<strong>claro</strong>');
    expect(html).not.toMatch(/<script>alert/);
    expect(html).toContain('Congreso de Innovación 2026'); // bloque event_catalog
    expect(html).toContain('¿Funciona?');
    expect(html).toContain('<title>Guía de prueba · Sitio de prueba</title>');
  });

  it('una ruta sin página responde 404', async () => {
    expect((await page('/nada-por-aqui')).response.status).toBe(404);
  });
});

describe('sitio del CMS: menú, marca y tema', () => {
  it('el menú sale del CMS y un enlace peligroso se neutraliza', async () => {
    const { html } = await page('/eventos');
    expect(html).toMatch(/href="\/guia"[^>]*>\s*Guía/);
    expect(html).not.toContain('javascript:alert');
    expect(html).not.toContain('href="/nosotros"'); // el menú del CMS reemplaza al del diseño
  });

  it('el color de marca y el redondeo del tema llegan como variables CSS', async () => {
    const { html } = await page('/eventos');
    expect(html).toContain('--brand-primary:#aa3300');
    expect(html).toContain('--brand-primary-rgb:170 51 0');
    expect(html).toContain('--brand-radius:16px');
  });

  it('las páginas estáticas del diseño heredan el menú del sitio', async () => {
    const { response, html } = await page('/nosotros');
    expect(response.status).toBe(200);
    expect(html).toContain('Sitio de prueba');
    expect(html).toMatch(/href="\/guia"[^>]*>\s*Guía/);
  });
});

describe('inicio de sesión', () => {
  it('lleva al panel (BFF + OIDC) y nunca pide la contraseña aquí', async () => {
    const { response, html } = await page('/acceder');
    expect(response.status).toBe(200);
    expect(html).toContain(
      `href="${ADMIN_URL}/auth/login?return_to=${encodeURIComponent(`${ADMIN_URL}/`)}"`,
    );
    expect(html).not.toMatch(/type="password"/);
  });
});

describe('seguridad del HTML y los recursos servidos', () => {
  const routes = [
    '/',
    '/eventos',
    '/eventos/congreso-2026',
    '/guia',
    '/acceder',
    '/nosotros',
    '/convocar/crear',
  ];

  it.each(routes)('%s: CSP estricta y sin scripts en línea', async (route) => {
    const { response, html } = await page(route);
    const csp = response.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/unsafe-eval|script-src[^;]*unsafe-inline/);
    // Todo `<script>` debe traer `src`: uno en línea lo bloquearía la CSP (y el menú móvil no abriría).
    for (const tag of html.match(/<script\b[^>]*>/g) ?? []) expect(tag, route).toMatch(/\bsrc=/);
    expect(html, route).not.toMatch(/\son[a-z]+=["']/);
    expect(html, route).not.toMatch(/(?:src|href)=["']https?:\/\/(?!admin\.example\.test)/);
  });

  it('el CSS conserva el comportamiento del build de Tailwind 3 del equipo de frontend', async () => {
    const { html } = await page('/');
    const [href] = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(
      (m) => m[1]!,
    );
    const css = await (await fetch(`${base}${href}`)).text();
    // El color de marca viaja como tripleta RGB: sin ella, `bg-primary/10` y similares perderían la transparencia.
    expect(css).toContain('var(--brand-primary-rgb');
    expect(css).toMatch(/\.text-primary\\\/15\{[^}]*--brand-primary-rgb/);
    // Los iconos van después de las utilidades (como en su CSS): todos miden 24 px salvo con `!text-*`.
    expect(css.indexOf('.material-symbols-outlined{')).toBeGreaterThan(css.indexOf('.text-2xl{'));
    expect(css).toContain('.\\!text-base');
  });

  it('las hojas de estilo no traen fuentes `data:` ni recursos externos', async () => {
    const { html } = await page('/');
    const sheets = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(
      (m) => m[1]!,
    );
    expect(sheets.length).toBeGreaterThan(0);
    for (const href of sheets) {
      const css = await (await fetch(`${base}${href}`)).text();
      expect(css, href).not.toContain('data:font');
      expect(css, href).not.toMatch(/url\(\s*["']?https?:/);
      expect(css, href).toContain('Material Symbols Outlined');
    }
  });

  it('las fuentes y los logos se sirven desde el propio sitio', async () => {
    const logo = await fetch(`${base}/brand/logo.png`);
    expect(logo.status).toBe(200);
    expect(logo.headers.get('content-type')).toContain('image/png');
  });
});

describe('cuando la Content API falla', () => {
  it('el inicio sigue sirviéndose, avisa y no se cachea', async () => {
    eventsDown = true;
    try {
      const { response, html } = await page('/');
      expect(response.status).toBe(200);
      expect(html).toContain('No pudimos cargar los eventos');
      expect(response.headers.get('cache-control')).toBe('no-store');
    } finally {
      eventsDown = false;
    }
  });

  it('el catálogo responde 503 sin cachear', async () => {
    eventsDown = true;
    try {
      const { response, html } = await page('/eventos');
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(html).toContain('No pudimos cargar los eventos');
    } finally {
      eventsDown = false;
    }
  });
});
