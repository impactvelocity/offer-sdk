-- Saved analytics reports (dashboard views: a name, entitlement ids and an
-- interval). Same document shape as the catalog resources.

create table analytics_reports (
  app_id      text not null references apps (id) on delete cascade,
  id          text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (app_id, id)
);
