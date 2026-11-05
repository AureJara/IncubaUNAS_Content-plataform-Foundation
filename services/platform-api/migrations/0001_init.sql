-- Platform API — esquema inicial.
-- Aislamiento: toda tabla de tenant lleva `organization_id` y RLS FORCE. El rol de runtime
-- (platform_app) es NOBYPASSRLS y el tenant se fija por transacción con set_config(..., true).
-- Tablas sin RLS a propósito (cada una documenta por qué): users/identities (directorio global de
-- identidad), host_routes (proyección pública de enrutamiento), sessions/login_attempts
-- (infraestructura de autenticación, siempre consultadas por id + secreto), bootstrap_requests,
-- outbox e inbox (infraestructura de mensajería).

create function app_current_organization() returns uuid
  language sql stable as $$ select nullif(current_setting('app.organization_id', true), '')::uuid $$;

create function app_current_user() returns uuid
  language sql stable as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

-- ---------------------------------------------------------------- identidad global
create table users (
  id uuid primary key,
  display_name text,
  email_ciphertext text,
  email_blind_index text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index users_email_blind_idx on users (email_blind_index);

create table identities (
  id uuid primary key,
  user_id uuid not null references users (id),
  issuer text not null,
  subject text not null,
  created_at timestamptz not null,
  unique (issuer, subject)
);
create index identities_user_idx on identities (user_id);

-- ---------------------------------------------------------------- tenants
create table organizations (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  legal_name text,
  display_name text not null,
  timezone text not null,
  locale text not null,
  state text not null check (state in ('provisioning', 'active', 'suspended', 'archived')),
  revision bigint not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  created_by uuid,
  updated_by uuid
);
alter table organizations enable row level security;
alter table organizations force row level security;
create policy organizations_insert on organizations for insert with check (id = app_current_organization());
create policy organizations_update on organizations for update
  using (id = app_current_organization()) with check (id = app_current_organization());

-- ---------------------------------------------------------------- membresías
create table memberships (
  id uuid primary key,
  organization_id uuid not null references organizations (id),
  user_id uuid not null references users (id),
  state text not null check (state in ('invited', 'active', 'suspended', 'revoked', 'expired')),
  restrictions jsonb not null default '[]'::jsonb,
  revision bigint not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  created_by uuid,
  updated_by uuid
);
-- Una persona tiene una sola membresía vigente por organización, pero puede volver a entrar
-- después de ser revocada (la revocada es terminal y queda como historia).
create unique index memberships_one_current_idx on memberships (organization_id, user_id)
  where state in ('invited', 'active', 'suspended');
create index memberships_user_active_idx on memberships (user_id) where state = 'active';
alter table memberships enable row level security;
alter table memberships force row level security;
create policy memberships_select on memberships for select
  using (organization_id = app_current_organization() or user_id = app_current_user());
create policy memberships_insert on memberships for insert with check (organization_id = app_current_organization());
create policy memberships_update on memberships for update
  using (organization_id = app_current_organization()) with check (organization_id = app_current_organization());

-- Se ve la organización activa y también aquellas de las que el usuario es miembro activo
-- (necesario para "mis organizaciones" sin cambiar de tenant). Va después de `memberships`
-- porque la política consulta esa tabla.
create policy organizations_select on organizations for select using (
  id = app_current_organization()
  or exists (
    select 1 from memberships m
    where m.organization_id = organizations.id and m.user_id = app_current_user() and m.state = 'active'
  )
);

create table membership_roles (
  membership_id uuid not null references memberships (id) on delete cascade,
  organization_id uuid not null references organizations (id),
  role text not null check (role in (
    'org_owner', 'security_admin', 'site_editor', 'event_manager',
    'application_reviewer', 'checkin_staff', 'checkin_supervisor', 'report_viewer'
  )),
  primary key (membership_id, role)
);
create index membership_roles_org_idx on membership_roles (organization_id, role);
alter table membership_roles enable row level security;
alter table membership_roles force row level security;
create policy membership_roles_select on membership_roles for select using (
  organization_id = app_current_organization()
  or exists (select 1 from memberships m where m.id = membership_roles.membership_id and m.user_id = app_current_user())
);
create policy membership_roles_insert on membership_roles for insert with check (organization_id = app_current_organization());
create policy membership_roles_delete on membership_roles for delete using (organization_id = app_current_organization());

-- Una organización activa o suspendida nunca queda sin un org_owner activo. La verificación es
-- diferida al commit para permitir cambios que, en conjunto, dejan un owner (p. ej. traspasar).
create function assert_org_has_owner(org uuid) returns void language plpgsql as $$
declare
  org_state text;
  owners integer;
begin
  select state into org_state from organizations where id = org;
  if org_state is null or org_state in ('provisioning', 'archived') then
    return;
  end if;
  select count(*) into owners
    from memberships m join membership_roles r on r.membership_id = m.id
   where m.organization_id = org and m.state = 'active' and r.role = 'org_owner';
  if owners = 0 then
    raise exception 'last_owner_required' using errcode = 'P0001';
  end if;
end $$;

create function trg_member_owner_guard() returns trigger language plpgsql as $$
begin
  perform assert_org_has_owner(coalesce(new.organization_id, old.organization_id));
  return null;
end $$;

create function trg_org_owner_guard() returns trigger language plpgsql as $$
begin
  perform assert_org_has_owner(new.id);
  return null;
end $$;

create constraint trigger memberships_owner_guard after insert or update or delete on memberships
  deferrable initially deferred for each row execute function trg_member_owner_guard();
create constraint trigger membership_roles_owner_guard after insert or update or delete on membership_roles
  deferrable initially deferred for each row execute function trg_member_owner_guard();
create constraint trigger organizations_owner_guard after update of state on organizations
  deferrable initially deferred for each row execute function trg_org_owner_guard();

-- ---------------------------------------------------------------- invitaciones
create table invitations (
  id uuid primary key,
  organization_id uuid not null references organizations (id),
  email_ciphertext text not null,
  email_blind_index text not null,
  roles text[] not null check (cardinality(roles) > 0),
  token_hash text not null unique,
  state text not null check (state in ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  expires_at timestamptz not null,
  accepted_by uuid references users (id),
  revision bigint not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  created_by uuid
);
-- No hay dos invitaciones pendientes para el mismo correo en la misma organización.
create unique index invitations_one_pending_idx on invitations (organization_id, email_blind_index)
  where state = 'pending';
alter table invitations enable row level security;
alter table invitations force row level security;
create policy invitations_all on invitations for all
  using (organization_id = app_current_organization()) with check (organization_id = app_current_organization());

-- ---------------------------------------------------------------- sesiones (sin RLS: infraestructura de auth)
create table sessions (
  id uuid primary key,
  user_id uuid not null references users (id),
  organization_id uuid references organizations (id),
  secret_hash text not null,
  previous_secret_hash text,
  device_label text,
  ip_pseudonym text,
  auth_time timestamptz not null,
  amr text[] not null default '{}',
  created_at timestamptz not null,
  last_used_at timestamptz not null,
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text
);
create index sessions_user_active_idx on sessions (user_id) where revoked_at is null;

-- Intento de login en curso (state, nonce y PKCE). Se consume una sola vez.
create table login_attempts (
  id uuid primary key,
  attempt_hash text not null unique,
  state text not null,
  nonce text not null,
  code_verifier_ciphertext text not null,
  return_to text not null,
  created_at timestamptz not null,
  expires_at timestamptz not null
);

-- ---------------------------------------------------------------- cuentas de servicio
create table service_accounts (
  id uuid primary key,
  organization_id uuid not null references organizations (id),
  name text not null,
  auth_method text not null check (auth_method in ('client_secret', 'private_key_jwt')),
  scopes text[] not null,
  audiences text[] not null,
  state text not null check (state in ('active', 'revoked')),
  expires_at timestamptz not null,
  revision bigint not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  created_by uuid,
  unique (organization_id, name)
);
alter table service_accounts enable row level security;
alter table service_accounts force row level security;
create policy service_accounts_all on service_accounts for all
  using (organization_id = app_current_organization()) with check (organization_id = app_current_organization());

create table service_credentials (
  id uuid primary key,
  service_account_id uuid not null references service_accounts (id),
  organization_id uuid not null references organizations (id),
  secret_hash text,
  public_jwk jsonb,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null
);
create index service_credentials_org_idx on service_credentials (organization_id, service_account_id);
alter table service_credentials enable row level security;
alter table service_credentials force row level security;
create policy service_credentials_all on service_credentials for all
  using (organization_id = app_current_organization()) with check (organization_id = app_current_organization());

-- ---------------------------------------------------------------- dominios
create table domains (
  id uuid primary key,
  organization_id uuid not null references organizations (id),
  site_id uuid not null,
  hostname text not null unique check (hostname = lower(hostname)),
  state text not null check (state in ('pending', 'verifying', 'active', 'failed', 'suspended', 'released')),
  is_primary boolean not null default false,
  challenge_method text not null check (challenge_method in ('dns_txt', 'http_file')),
  challenge_name text not null,
  challenge_value text not null,
  activated_at timestamptz,
  revision bigint not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  created_by uuid
);
create index domains_site_idx on domains (organization_id, site_id);
alter table domains enable row level security;
alter table domains force row level security;
create policy domains_all on domains for all
  using (organization_id = app_current_organization()) with check (organization_id = app_current_organization());

-- Proyección pública de enrutamiento host → sitio: solo identificadores opacos de dominios activos.
create table host_routes (
  hostname text primary key,
  site_id uuid not null,
  organization_id uuid not null,
  updated_at timestamptz not null
);

-- ---------------------------------------------------------------- auditoría e idempotencia
create table security_audit (
  id uuid primary key,
  organization_id uuid references organizations (id),
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
  organization_id uuid not null references organizations (id),
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

-- Alta de organizaciones: aún no existe tenant, por eso la clave no pertenece a uno.
create table bootstrap_requests (
  actor_id text not null,
  key text not null,
  request_hash text not null,
  organization_id uuid not null references organizations (id),
  response jsonb not null,
  created_at timestamptz not null,
  primary key (actor_id, key)
);

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
grant select, insert, update on users, identities, organizations, memberships, invitations, sessions,
  service_accounts, domains, outbox to platform_app;
grant select, insert, delete on membership_roles, login_attempts, host_routes, service_credentials to platform_app;
grant update on host_routes, service_credentials to platform_app;
grant select, insert on security_audit, idempotency_keys, bootstrap_requests, inbox to platform_app;
-- idempotency_keys se reescribe al repetir una clave vencida y se purga al caducar.
grant update, delete on idempotency_keys to platform_app;
-- security_audit es append-only: el rol de runtime no recibe UPDATE ni DELETE.
