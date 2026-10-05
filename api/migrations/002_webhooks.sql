-- Webhooks: endpoints an app registers, the events it emits, and one delivery
-- row per (event, endpoint) that the worker drives through the retry schedule.
-- Unlike the JSONB resources these are real columns: the API owns the shape.

create table webhook_endpoints (
  id               text primary key,
  app_id           text not null references apps (id) on delete cascade,
  url              text not null,
  description      text,
  events           jsonb not null,   -- array of event types, or ["*"] for all
  enabled          boolean not null default true,
  source           text not null default 'custom' check (source in ('custom', 'zapier')),
  secret           text not null,
  disabled_reason  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index webhook_endpoints_app_idx on webhook_endpoints (app_id, created_at);

-- Every emitted event, kept for 30 days (the worker prunes older ones).
create table webhook_events (
  id          text primary key,
  app_id      text not null references apps (id) on delete cascade,
  type        text not null,
  data        jsonb not null,
  test        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index webhook_events_app_created_idx on webhook_events (app_id, created_at desc);
create index webhook_events_app_type_created_idx on webhook_events (app_id, type, created_at desc);

create table webhook_deliveries (
  id               text primary key,
  endpoint_id      text not null references webhook_endpoints (id) on delete cascade,
  event_id         text not null references webhook_events (id) on delete cascade,
  status           text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  attempts         int not null default 0,
  next_attempt_at  timestamptz,  -- when the worker should next try; null once finished
  last_attempt_at  timestamptz,
  response_status  int,
  response_body    text,         -- first 1024 chars
  error            text,
  duration_ms      int,
  test             boolean not null default false,
  created_at       timestamptz not null default now()
);

create index webhook_deliveries_due_idx on webhook_deliveries (next_attempt_at) where status = 'pending';
create index webhook_deliveries_endpoint_created_idx on webhook_deliveries (endpoint_id, created_at desc);
-- Keeps the cascade from pruned events cheap.
create index webhook_deliveries_event_idx on webhook_deliveries (event_id);

-- Delivery ids for emit()'s fan-out are generated in SQL, so one statement can
-- insert the event and a delivery per subscribed endpoint. Same alphabet as
-- src/lib/ids.ts.
create function webhook_random_id(prefix text, size int) returns text
language sql volatile as $$
  select prefix || '_' || string_agg(
    substr('ABCDEFGHIJKLMNOPQRSTWXYZabcdefghijklmnopqrstwxyz', 1 + floor(random() * 48)::int, 1), '')
  from generate_series(1, size)
$$;
