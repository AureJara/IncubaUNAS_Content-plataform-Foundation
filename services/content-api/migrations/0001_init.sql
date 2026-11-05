-- Content API — esquema inicial.
-- Datos de tenant (sitios, borradores, publicaciones, medios, releases): RLS FORCE por organization_id.
-- Modelo público de lectura (public_*): proyección CQRS con datos ya publicados, sin RLS a propósito,
-- porque lo consulta el CDN/Astro sin contexto de organización y no contiene datos privados.

create function app_current_organization() returns uuid
  language sql stable as $$ select nullif(current_setting('app.organization_id', true), '')::uuid $$;

-- ---------------------------------------------------------------- sitios
create table sites (
  id uuid primary key,
  organization_id uuid not null,
  -- El slug es único globalmente: es la clave pública que resuelve el CDN.
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  name text not null,
  kind text not null check (kind in ('product', 'demo', 'client')),
  locale text not null,
  theme jsonb not null default '{}'::jsonb,
  navigation jsonb not null default '[]'::jsonb,
  revision bigint not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  created_by uuid,
  updated_by uuid
);
create index sites_org_idx on sites (organization_id, created_at, id);

-- ---------------------------------------------------------------- páginas
create table pages (
  id uuid primary key,
  organization_id uuid not null,
  site_id uuid not null references sites (id),
  path text not null check (path ~ '^/([a-z0-9-]+(/[a-z0-9-]+)*)?$'),
  title text not null,
  locale text not null,
  blocks jsonb not null default '[]'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  published_version integer,
  revision bigint not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  created_by uuid,
  updated_by uuid,
  unique (site_id, path)
);
create index pages_org_site_idx on pages (organization_id, site_id, created_at, id);

-- Cada publicación es un snapshot inmutable: el rol de runtime no recibe UPDATE ni DELETE.
create table page_publications (
  id uuid primary key,
  organization_id uuid not null,
  page_id uuid not null references pages (id),
  version integer not null,
  snapshot jsonb not null,
  content_hash text not null check (content_hash ~ '^sha256:[0-9a-f]{64}$'),
  restored_from_version integer,
  published_at timestamptz not null,
  published_by uuid,
  unique (page_id, version)
);
create index page_publications_org_idx on page_publications (organization_id, page_id, version);

create table preview_tokens (
  id uuid primary key,
  organization_id uuid not null,
  page_id uuid not null references pages (id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid,
  created_at timestamptz not null
);
create index preview_tokens_org_idx on preview_tokens (organization_id, page_id);

-- ---------------------------------------------------------------- medios
create table media_assets (
  id uuid primary key,
  organization_id uuid not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null,
  alt_text text,
  storage_key text not null,
  state text not null check (state in ('pending', 'scanning', 'ready', 'quarantined')),
  revision bigint not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  created_by uuid
);
create index media_assets_org_idx on media_assets (organization_id, created_at, id);

-- ---------------------------------------------------------------- releases de eventos (proyección)
create table event_releases (
  id uuid primary key, -- publication_id de Configuration
  organization_id uuid not null,
  event_id uuid not null,
  release_version integer not null,
  status text not null check (status in ('pending', 'active', 'failed', 'superseded')),
  manifest jsonb,
  manifest_hash text not null,
  aggregate_version integer not null,
  error text,
  created_at timestamptz not null,
  activated_at timestamptz
);
create index event_releases_org_idx on event_releases (organization_id, event_id, release_version);
-- Una sola release activa por evento: la activación es atómica o no ocurre.
create unique index event_releases_one_active_idx on event_releases (event_id) where status = 'active';

-- ---------------------------------------------------------------- modelo público de lectura (sin RLS)
create table public_sites (
  slug text primary key,
  site_id uuid not null unique,
  organization_id uuid not null,
  name text not null,
  locale text not null,
  theme jsonb not null,
  navigation jsonb not null,
  updated_at timestamptz not null
);

create table public_pages (
  site_slug text not null references public_sites (slug) on delete cascade,
  path text not null,
  page_id uuid not null,
  publication_id uuid not null,
  version integer not null,
  title text not null,
  locale text not null,
  blocks jsonb not null,
  seo jsonb not null,
  content_hash text not null,
  published_at timestamptz not null,
  primary key (site_slug, path)
);

create table public_events (
  event_id uuid primary key,
  site_id uuid not null,
  organization_id uuid not null,
  slug text not null,
  title text not null,
  kind text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  status text not null check (status in ('published', 'closed', 'cancelled')),
  publication_id uuid not null,
  release_version integer not null,
  programs jsonb not null default '[]'::jsonb,
  sessions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null,
  unique (site_id, slug)
);
create index public_events_site_idx on public_events (site_id, starts_at, event_id);

create table public_event_availability (
  event_id uuid primary key,
  public_state text not null check (public_state in ('not_open', 'open', 'waitlist_only', 'closed')),
  remaining_band text check (remaining_band in ('plenty', 'few', 'none')),
  as_of timestamptz not null
);

-- ---------------------------------------------------------------- RLS de las tablas de tenant
alter table sites enable row level security;
alter table sites force row level security;
create policy sites_all on sites for all
  using (organization_id = app_current_organization()) with check (organization_id = app_current_organization());

alter table pages enable row level security;
alter table pages force row level security;
create policy pages_all on pages for all
  using (organization_id = app_current_organization()) with check (organization_id = app_current_organization());

alter table page_publications enable row level security;
alter table page_publications force row level security;
create policy page_publications_select on page_publications for select using (organization_id = app_current_organization());
create policy page_publications_insert on page_publications for insert with check (organization_id = app_current_organization());

alter table preview_tokens enable row level security;
alter table preview_tokens force row level security;
create policy preview_tokens_all on preview_tokens for all
  using (organization_id = app_current_organization()) with check (organization_id = app_current_organization());

alter table media_assets enable row level security;
alter table media_assets force row level security;
create policy media_assets_all on media_assets for all
  using (organization_id = app_current_organization()) with check (organization_id = app_current_organization());

alter table event_releases enable row level security;
alter table event_releases force row level security;
create policy event_releases_all on event_releases for all
  using (organization_id = app_current_organization()) with check (organization_id = app_current_organization());

-- ---------------------------------------------------------------- auditoría e idempotencia (mismo DDL que Platform)
create table security_audit (
  id uuid primary key,
  organization_id uuid,
  occurred_at timestamptz not null,
  actor_type text not null check (actor_type in ('user', 'service', 'system')),
  actor_id text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  outcome text not null check (outcome in ('success', 'denied', 'failure')),
  request_id text not null,
  metadata jsonb not null default '{}'::jsonb
);
create index security_audit_org_time_idx on security_audit (organization_id, occurred_at desc, id desc);
alter table security_audit enable row level security;
alter table security_audit force row level security;
create policy security_audit_select on security_audit for select using (organization_id = app_current_organization());
create policy security_audit_insert on security_audit for insert
  with check (organization_id is null or organization_id = app_current_organization());

create table idempotency_keys (
  organization_id uuid not null,
  actor_id text not null,
  operation text not null,
  key text not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  primary key (organization_id, actor_id, operation, key)
);
alter table idempotency_keys enable row level security;
alter table idempotency_keys force row level security;
create policy idempotency_all on idempotency_keys for all
  using (organization_id = app_current_organization()) with check (organization_id = app_current_organization());

-- ---------------------------------------------------------------- mensajería (idéntico a packages/events/sql/outbox_inbox.sql)
create table outbox (
  id bigint generated always as identity primary key,
  domain_event_id uuid not null unique,
  message_id uuid not null,
  topic text not null,
  organization_id uuid not null,
  partition_key text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  aggregate_version integer not null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'published', 'dead')),
  attempts integer not null default 0,
  available_at timestamptz not null,
  last_error text,
  published_at timestamptz,
  created_at timestamptz not null
);
create index outbox_pending_idx on outbox (available_at, id) where status = 'pending';

create table inbox (
  consumer_name text not null,
  domain_event_id uuid not null,
  organization_id uuid not null,
  topic text not null,
  aggregate_id uuid,
  aggregate_version integer,
  processed_at timestamptz not null,
  primary key (consumer_name, domain_event_id)
);

-- ---------------------------------------------------------------- privilegios del rol de runtime
grant select, insert, update on sites, pages, media_assets, event_releases, outbox to content_app;
grant select, insert, update on preview_tokens to content_app;
grant select, insert on page_publications, security_audit, inbox to content_app;
grant select, insert, update, delete on idempotency_keys to content_app;
grant select, insert, update, delete on public_sites, public_pages, public_events, public_event_availability to content_app;
-- page_publications y security_audit son append-only: sin UPDATE ni DELETE para el rol de runtime.
