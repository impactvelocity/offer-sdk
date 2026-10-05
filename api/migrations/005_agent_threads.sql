-- Dashboard agent chat threads. Each belongs to one dashboard user and one app;
-- `messages` holds the AI SDK UI messages as the dashboard renders them.

create table agent_threads (
  app_id      text not null references apps (id) on delete cascade,
  id          text not null,
  user_id     text not null,
  title       text not null default '',
  messages    jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (app_id, id)
);

create index agent_threads_user_idx on agent_threads (app_id, user_id, updated_at desc);
