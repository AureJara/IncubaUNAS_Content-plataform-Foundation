// Datos de demostración para DESARROLLO LOCAL (PF-041): un sitio "demo" con su página de inicio publicada
// y un evento de ejemplo en la proyección pública. Sin datos personales y reproducible: se puede
// ejecutar varias veces y siempre deja el mismo contenido.
//
//   pnpm --filter @incubaunas/content-api seed:demo
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { SignJWT } from 'jose';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta ${name} en el entorno (.env).`);
    process.exit(1);
  }
  return value;
};

const API = process.env.CONTENT_API_URL ?? 'http://localhost:4001';
const SLUG = process.env.SITE_SLUG ?? 'demo';
const DEMO_ORG = '00000000-0000-7000-8000-00000000d3a0'; // organización ficticia de la demo
const now = Math.floor(Date.now() / 1000);

const token = await new SignJWT({
  roles: ['site_editor'],
  scopes: [],
  amr: ['pwd', 'mfa'],
  organization_id: DEMO_ORG,
})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject('service:seed-demo')
  .setIssuer(process.env.INTERNAL_JWT_ISSUER ?? 'https://platform.incubaunas.local')
  .setAudience(process.env.CONTENT_JWT_AUDIENCE ?? 'content-api')
  .setIssuedAt(now)
  .setExpirationTime(now + 600)
  .sign(new TextEncoder().encode(required('INTERNAL_JWT_SECRET')));

async function call(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'idempotency-key': randomUUID(),
      ...(body
        ? {
            'content-type':
              method === 'PATCH' ? 'application/merge-patch+json' : 'application/json',
          }
        : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

// 1) Sitio (si ya existe, se reutiliza) con el tema y el menú del diseño: se reaplican en cada corrida
const existing = await call('GET', '/cms/v1/sites');
let site = existing.body.items.find((s: { slug: string }) => s.slug === SLUG);
if (!site) {
  const created = await call('POST', '/cms/v1/sites', {
    slug: SLUG,
    name: 'IncubaUNAS (demo)',
    kind: 'demo',
    locale: 'es-PE',
  });
  if (created.status !== 201)
    throw new Error(`No se pudo crear el sitio: ${JSON.stringify(created.body)}`);
  site = created.body;
}
const themed = await call(
  'PATCH',
  `/cms/v1/sites/${site.id}`,
  {
    theme: {
      color_background: '#ffffff',
      color_text: '#14213d',
      color_primary: '#005bbf',
      font_family: 'system-ui',
      radius: 'md',
    },
    // Mismo menú que el diseño del sitio público (apps/web-public/src/lib/nav.ts).
    navigation: [
      { label: 'Nosotros', href: '/nosotros' },
      { label: 'Eventos', href: '/eventos' },
      { label: 'Programas', href: '/programas' },
      { label: 'Convocar', href: '/convocar' },
      { label: 'Portafolio', href: '/portafolio' },
    ],
  },
  { 'if-match': `"${site.revision}"` },
);
if (themed.status !== 200)
  throw new Error(`No se pudo aplicar el tema: ${JSON.stringify(themed.body)}`);
site = themed.body;

// 2) Páginas del CMS, publicadas. El inicio ('/') lo sirve la plantilla del sitio público
// (apps/web-public/src/pages/index.astro), así que el CMS no lo muestra; '/guia' sí sale del CMS
// y ejercita los bloques (hero, texto, catálogo de eventos, FAQ y llamada a la acción).
const pages = await call('GET', `/cms/v1/sites/${site.id}/pages`);
const blocks = [
  {
    type: 'hero',
    props: {
      heading: 'Eventos y convocatorias de IncubaUNAS',
      subheading: 'Inscríbete, recibe tu entrada con QR y obtén tu certificado en un solo lugar.',
      cta_label: 'Ver eventos',
      cta_href: '/eventos',
    },
  },
  {
    type: 'rich_text',
    props: {
      markdown:
        '## Sin hojas de cálculo ni listas impresas\n\nPublica tu evento, recibe inscripciones con **cupos y lista de espera** y registra la asistencia desde el celular.',
    },
  },
  { type: 'event_catalog', props: { limit: 6 } },
  {
    type: 'faq',
    props: {
      items: [
        {
          question: '¿Cuánto cuesta?',
          answer: 'Esta es una demostración: los eventos del MVP son gratuitos.',
        },
        {
          question: '¿Dónde obtengo mi certificado?',
          answer: 'Al terminar el evento lo recibes por correo y puedes verificarlo en línea.',
        },
      ],
    },
  },
];
async function publishPage(path: string, title: string, pageBlocks: unknown[]) {
  let page = pages.body.items.find((p: { path: string }) => p.path === path);
  if (!page) {
    page = (
      await call('POST', `/cms/v1/sites/${site.id}/pages`, { path, title, blocks: pageBlocks })
    ).body;
  } else {
    page = (
      await call(
        'PATCH',
        `/cms/v1/pages/${page.id}`,
        { title, blocks: pageBlocks },
        { 'if-match': `"${page.revision}"` },
      )
    ).body;
  }
  const result = await call('POST', `/cms/v1/pages/${page.id}/publications`, {
    expected_revision: page.revision,
  });
  if (result.status !== 201)
    throw new Error(`No se pudo publicar ${path}: ${JSON.stringify(result.body)}`);
  return result.body;
}

const published = await publishPage('/', 'Inicio', blocks);
await publishPage('/guia', 'Guía para organizadores', [
  ...blocks,
  { type: 'cta', props: { label: 'Ver todos los eventos', href: '/eventos' } },
]);

// 3) Evento de ejemplo en la proyección pública (en producción llega por el evento de Configuration)
const db = new pg.Client({ connectionString: required('CONTENT_DATABASE_ADMIN_URL') });
await db.connect();
const eventId = '00000000-0000-7000-8000-00000000e001';
const at = (days: number, hour: number) =>
  new Date(Date.UTC(2026, 11, 1 + days, hour)).toISOString();
await db.query(
  `insert into public_events (event_id, site_id, organization_id, slug, title, kind, description, starts_at, ends_at, timezone,
                              status, publication_id, release_version, programs, sessions, updated_at)
   values ($1, $2, $3, 'congreso-innovacion-2026', 'Congreso de Innovación 2026', 'congreso',
           'Tres días de ponencias, talleres y demostraciones de emprendimientos.', $4, $5, 'America/Lima', 'published',
           $6, 1, $7::jsonb, $8::jsonb, now())
   on conflict (event_id) do update set title = excluded.title, programs = excluded.programs, sessions = excluded.sessions, updated_at = now()`,
  [
    eventId,
    site.id,
    DEMO_ORG,
    at(0, 14),
    at(2, 23),
    randomUUID(),
    JSON.stringify([
      { slug: 'ia', name: 'Inteligencia Artificial', color: '#0b5fff' },
      { slug: 'emprendimiento', name: 'Emprendimiento', color: '#b4231f' },
    ]),
    JSON.stringify([
      {
        id: randomUUID(),
        program_slug: 'ia',
        title: 'Apertura y panorama de la IA',
        starts_at: at(0, 15),
        ends_at: at(0, 16),
        venue_name: 'Auditorio principal',
        speakers: ['Ana Torres'],
      },
      {
        id: randomUUID(),
        program_slug: 'emprendimiento',
        title: 'Cómo validar tu idea en 30 días',
        starts_at: at(0, 15),
        ends_at: at(0, 16),
        venue_name: 'Sala B',
        speakers: ['Luis Ramos'],
      },
      {
        id: randomUUID(),
        program_slug: 'ia',
        title: 'IA aplicada a la agricultura',
        starts_at: at(0, 17),
        ends_at: at(0, 18),
        venue_name: 'Auditorio principal',
        speakers: ['Rosa Vega'],
      },
    ]),
  ],
);
await db.query(
  `insert into public_event_availability (event_id, public_state, remaining_band, as_of) values ($1, 'open', 'plenty', now())
   on conflict (event_id) do update set public_state = excluded.public_state, remaining_band = excluded.remaining_band, as_of = excluded.as_of`,
  [eventId],
);
await db.end();

console.log(
  `Demo lista: sitio "${SLUG}" con inicio publicado (v${published.version}), la página /guia y un evento de ejemplo.`,
);
