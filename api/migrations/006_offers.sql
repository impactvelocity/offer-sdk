-- Offers: deals on an app's core plans, sold through the SDK checkout and PayPal.
-- An offer lists plans, can lower their price and add entitlements, and has
-- bumps. Buying one sets the account's plan and records the deal on the account
-- as `data.subscription`.

create table offers (
  app_id      text not null references apps (id) on delete cascade,
  id          text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (app_id, id)
);

-- One row per checkout started from the SDK. `quote` is the priced selection,
-- fixed when the checkout is created, so later offer edits never change what a
-- buyer agreed to. `status` guards grants: only a `created` row can complete.
create table checkouts (
  id            text primary key,
  app_id        text not null references apps (id) on delete cascade,
  offer_id      text,
  plan_id       text not null,
  interval      text not null check (interval in ('month', 'year', 'once')),
  bump_ids      jsonb not null default '[]',
  account_id    text,
  email         text,
  ref           text,
  quote         jsonb not null,
  paypal_kind   text check (paypal_kind in ('subscription', 'order')),
  paypal_id     text,
  status        text not null default 'created'
                check (status in ('created', 'completed', 'expired', 'failed', 'cancelled')),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create unique index checkouts_paypal_idx on checkouts (app_id, paypal_id) where paypal_id is not null;
create index checkouts_app_offer_idx on checkouts (app_id, offer_id, created_at desc);

-- Each app's own PayPal REST app. The secret is encrypted (src/lib/secrets.ts).
create table paypal_connections (
  app_id         text primary key references apps (id) on delete cascade,
  env            text not null check (env in ('sandbox', 'live')),
  client_id      text not null,
  client_secret  text not null,
  webhook_id     text,
  product_id     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- PayPal billing plans are created on demand, one per distinct price shape
-- (interval, currency, sale price and cycles, list price), and reused.
create table paypal_plans (
  app_id          text not null references apps (id) on delete cascade,
  key             text not null,
  paypal_plan_id  text not null,
  created_at      timestamptz not null default now(),
  primary key (app_id, key)
);

-- PayPal webhook event ids already handled; PayPal retries until it gets a 2xx.
create table paypal_webhook_events (
  app_id      text not null references apps (id) on delete cascade,
  id          text not null,
  type        text not null,
  created_at  timestamptz not null default now(),
  primary key (app_id, id)
);

-- Funnel events for offer stats: viewed, checkout_started, completed.
create table offer_events (
  id           bigint generated always as identity primary key,
  app_id       text not null references apps (id) on delete cascade,
  offer_id     text not null,
  type         text not null,
  plan_id      text,
  interval     text,
  ref          text,
  checkout_id  text,
  created_at   timestamptz not null default now()
);

create index offer_events_app_offer_idx on offer_events (app_id, offer_id, created_at);

-- Accounts by the offer they bought through, and by PayPal subscription id.
alter table namespaces
  add column offer_id text generated always as (data -> 'subscription' ->> 'offer_id') stored;
create index namespaces_app_offer_idx on namespaces (app_id, offer_id, created_at desc) where offer_id is not null;
create index namespaces_provider_idx on namespaces ((data -> 'subscription' ->> 'provider_id'))
  where data -> 'subscription' ->> 'provider_id' is not null;
