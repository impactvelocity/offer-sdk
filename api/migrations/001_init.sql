-- Offer API schema.
--
-- Resources are stored as JSONB documents (`data`) so PATCH keeps the legacy
-- shallow-merge semantics ({ ...current, ...payload }) and arbitrary fields
-- like plan `meta` / `pricingCard` round-trip untouched. Lookup keys live in
-- real columns so they can be indexed and constrained.

create extension if not exists pg_trgm;

create table apps (
  id          text primary key,
  api_key     text not null unique,
  public_key  text not null unique,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table orgs (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table entitlements (
  app_id      text not null references apps (id) on delete cascade,
  id          text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (app_id, id)
);

create table addons (
  app_id      text not null references apps (id) on delete cascade,
  id          text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (app_id, id)
);

create table plans (
  app_id      text not null references apps (id) on delete cascade,
  id          text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (app_id, id)
);

create table incentives (
  app_id      text not null references apps (id) on delete cascade,
  id          text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (app_id, id)
);

-- Replaces the Typesense `namespaces_{appId}` collections: the searchable
-- fields are generated from the document so they can never drift.
create table namespaces (
  app_id      text not null references apps (id) on delete cascade,
  id          text not null,
  data        jsonb not null,
  name        text generated always as (data ->> 'name') stored,
  plan        text generated always as (data ->> 'plan') stored,
  incentive   text generated always as (data ->> 'incentive') stored,
  created_at  timestamptz not null default now(),
  primary key (app_id, id)
);

create index namespaces_app_created_idx on namespaces (app_id, created_at desc);
create index namespaces_app_plan_idx on namespaces (app_id, plan, created_at desc);
create index namespaces_app_incentive_idx on namespaces (app_id, incentive, created_at desc) where incentive is not null;
create index namespaces_name_trgm_idx on namespaces using gin (name gin_trgm_ops);
create index namespaces_id_trgm_idx on namespaces using gin (id gin_trgm_ops);

-- Replaces the Redis `usage:{appId}:{nsId}:{entitlementId}` counters.
create table usage_counters (
  app_id          text not null,
  namespace_id    text not null,
  entitlement_id  text not null,
  count           bigint not null default 0,
  updated_at      timestamptz not null default now(),
  primary key (app_id, namespace_id, entitlement_id),
  foreign key (app_id, namespace_id) references namespaces (app_id, id) on delete cascade
);

-- Replaces the Tinybird `usage` datasource. Kept when a namespace is deleted
-- so historical analytics stay intact; removed with the app.
create table usage_events (
  id              bigint generated always as identity primary key,
  app_id          text not null references apps (id) on delete cascade,
  namespace_id    text not null,
  entitlement_id  text not null,
  operation       text not null check (operation in ('add', 'remove', 'amount')),
  amount          bigint not null,
  count           bigint not null,
  created_at      timestamptz not null default now()
);

create index usage_events_app_created_idx on usage_events (app_id, created_at);
create index usage_events_app_ns_created_idx on usage_events (app_id, namespace_id, created_at);
