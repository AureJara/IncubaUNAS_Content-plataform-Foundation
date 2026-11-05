-- Tablas de infraestructura de mensajería (transactional outbox + inbox idempotente).
-- Cada servicio incluye este mismo DDL en su migración inicial. No son tablas de tenant: ninguna API
-- las expone, solo las usan el relay y los consumidores, por eso no llevan política RLS.
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
