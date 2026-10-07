-- MCP server (src/mcp). Each app serves one at /apps/:appId/mcp.

-- Per-app switches. No row = the defaults (on, read & write, no overrides).
create table mcp_settings (
  app_id          text primary key references apps (id) on delete cascade,
  enabled         boolean not null default true,
  access_level    text not null default 'write' check (access_level in ('read', 'write', 'full')),
  -- tool name → on/off, where it differs from what access_level allows
  tool_overrides  jsonb not null default '{}',
  updated_at      timestamptz not null default now()
);

-- OAuth clients from dynamic client registration (RFC 7591). Not tied to an app:
-- the app is picked by the MCP URL the client connects to.
create table mcp_oauth_clients (
  id             text primary key,
  name           text not null,
  redirect_uris  jsonb not null,
  secret_hash    text,
  client_uri     text,
  logo_uri       text,
  created_at     timestamptz not null default now()
);

-- An authorization request, from /oauth/authorize until its code is exchanged.
-- The dashboard's consent page fills in the user, access level and code. Clients that
-- don't send `resource` leave app_id empty until the person picks an app.
create table mcp_oauth_requests (
  id              text primary key,
  client_id       text not null references mcp_oauth_clients (id) on delete cascade,
  app_id          text references apps (id) on delete cascade,
  redirect_uri    text not null,
  code_challenge  text not null,
  state           text,
  scope           text,
  resource        text,
  user_id         text,
  user_name       text,
  user_email      text,
  access_level    text check (access_level in ('read', 'write', 'full')),
  code_hash       text unique,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now()
);

-- A client that can call the server: an approved OAuth client (one per person and
-- client) or a client using the app's secret key (one per client name).
create table mcp_connections (
  id                  text primary key,
  app_id              text not null references apps (id) on delete cascade,
  auth                text not null check (auth in ('oauth', 'key')),
  client_id           text references mcp_oauth_clients (id) on delete cascade,
  client_name         text not null,
  user_id             text,
  user_name           text,
  user_email          text,
  access_level        text not null check (access_level in ('read', 'write', 'full')),
  access_token_hash   text unique,
  access_expires_at   timestamptz,
  refresh_token_hash  text unique,
  refresh_expires_at  timestamptz,
  created_at          timestamptz not null default now(),
  last_used_at        timestamptz
);

create unique index mcp_connections_oauth_idx on mcp_connections (app_id, client_id, user_id) where auth = 'oauth';
create unique index mcp_connections_key_idx on mcp_connections (app_id, client_name) where auth = 'key';

-- Tool calls, kept 30 days.
create table mcp_calls (
  id             text primary key,
  app_id         text not null references apps (id) on delete cascade,
  connection_id  text references mcp_connections (id) on delete set null,
  tool           text not null,
  args           jsonb not null default '{}',
  status         int not null,
  duration_ms    int not null,
  result         jsonb,
  created_at     timestamptz not null default now()
);

create index mcp_calls_app_idx on mcp_calls (app_id, created_at desc);
create index mcp_calls_connection_idx on mcp_calls (connection_id, created_at desc);
