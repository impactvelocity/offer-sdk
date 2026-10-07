-- Cancel flows: the questions an app asks when a customer cancels, and the
-- save offer it makes (fixed per answer, or decided per account by an LLM).
-- The SDK renders the flow; every run through it is a cancel session.

create table cancel_flows (
  app_id      text not null references apps (id) on delete cascade,
  id          text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (app_id, id)
);

-- One row per time a customer opened the flow. `data` holds the answers, the
-- offer shown and what happened to it. `status`: open → saved | cancelled |
-- abandoned.
create table cancel_sessions (
  id            text primary key,
  app_id        text not null references apps (id) on delete cascade,
  flow_id       text not null,
  account_id    text not null,
  status        text not null default 'open'
                check (status in ('open', 'saved', 'cancelled', 'abandoned')),
  data          jsonb not null,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index cancel_sessions_app_flow_idx on cancel_sessions (app_id, flow_id, created_at desc);
create index cancel_sessions_app_account_idx on cancel_sessions (app_id, account_id, created_at desc);

-- Paused subscriptions, by when they resume (see src/lib/pauses.ts).
create index namespaces_pause_resume_idx on namespaces ((data -> 'subscription' -> 'pause' ->> 'resume_at'))
  where data -> 'subscription' -> 'pause' ->> 'resume_at' is not null;
