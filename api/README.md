# Honeypot API

Headless Hono + Bun rebuild of the legacy Honeypot API (`honeyapi/api`). It keeps the same routes, auth rules, request bodies and response shapes. It also handles sign-in for the dashboard ([`../offer-app`](../offer-app)). The only backing service is **Postgres**, which replaces all three legacy services:

| Legacy | Now |
| --- | --- |
| Upstash Redis JSON docs and counters | Postgres tables: JSONB documents plus a `usage_counters` table updated with atomic upserts |
| Typesense namespace search | SQL filters with `ILIKE` on `namespaces` (trigram-indexed). Writes show up in search immediately. |
| Tinybird usage events and pipes | `usage_events` table, aggregated in SQL by `/analytics` |

Redis (Render Key Value) isn't needed.

## Run locally

```bash
docker compose up           # from the repo root: Postgres + the API, http://localhost:6767
```

Or with Bun and your own Postgres:

```bash
bun install
bun run dev                 # http://localhost:6767, docs at /docs
```

Outside production and tests, `src/dev-env.ts` fills in defaults, so no `.env` is needed: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/honey`, `ADMIN_API_KEY=dev-admin-key` (the dashboard's development default), `PORT=6767` and `WEBHOOKS_ALLOW_PRIVATE_URLS=true`. Dashboard origins on any localhost port are trusted. Use `.env` (see `.env.example`) to override them.

Pending migrations in `migrations/*.sql` run on boot. An advisory lock makes this safe across several instances. Set `MIGRATE_ON_BOOT=false` to run `bun run migrate` yourself instead.

```bash
DATABASE_URL=postgres://…/honey_test bun test   # end-to-end, truncates every table
bun run typecheck
```

## Dashboard sign-in

The dashboard's users, sessions and workspaces live here too: [better-auth](https://better-auth.com) with email/password and the organization plugin, stored in the `auth_*` tables (`src/lib/dashboard-auth.ts`). Browsers never call it directly. The dashboard forwards its `/api/auth/*` requests with the admin key, and `/api/auth/*` returns `401` without that key. Because of the forwarding, cookies are issued for the dashboard's domain (`APP_URL`), and only that origin is trusted.

- A workspace's id is also its `orgs` id, and the dashboard keeps its `app_ids` there. Deleting a workspace deletes that org record and any apps it still lists.
- Invitations aren't emailed yet. A pending invitation is accepted when that email signs up or signs in.
- The shared demo account (`demo@offersdk.dev`, seeded by the dashboard's `pnpm seed:demo`) can't update its profile, password or sessions, or manage its workspace and members (`403`).

## History import

`POST /apps/:appId/import` (admin key only) brings in history from before this API. It takes `namespaces` (`{ id, created_at }`) to backdate accounts and `usage_events` (`{ namespace_id, entitlement_id, operation, amount, created_at }`), up to 10,000 of each per request. Counters move by each event's amount, and each event's `count` continues from the counter. Everything is validated before anything is written, and no webhooks fire. The dashboard's demo seed uses it. It's also the way to carry over usage from another system.

| Env var | Default | |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | dev fallback | Signs session cookies. Required when `NODE_ENV=production`. |
| `APP_URL` | `http://localhost:6768` | The dashboard's public URL. |

## Webhooks

Apps can register up to 25 endpoints (`/apps/:appId/webhooks`) that receive events as JSON `POST`s. `GET /event-types` lists every type with a sample payload, and `GET /apps/:appId/events` shows the last 30 days of events.

| Category | Events |
| --- | --- |
| Accounts (namespaces) | `account.created`, `account.updated`, `account.deleted`, `account.plan_changed`, `account.incentive_applied`, `account.incentive_removed` |
| Usage | `usage.limit_warning` (crossed 80% of a limit), `usage.limit_reached` |
| Plans | `plan.created`, `plan.updated`, `plan.deleted` |
| Incentives | `incentive.created`, `incentive.updated`, `incentive.deleted` |

An endpoint subscribes to a list of types, or `["*"]` for everything. Update events carry the old values of changed fields in `data.previous`. Usage events fire once each time a count crosses the threshold, and are only computed when some endpoint listens for them.

**Signatures** follow [Standard Webhooks](https://www.standardwebhooks.com). Each request has `webhook-id` (the event id), `webhook-timestamp` (unix seconds) and `webhook-signature: v1,<sig>`, where `<sig>` is the base64 HMAC-SHA256 of `<id>.<timestamp>.<body>` keyed with the base64-decoded part of the secret after `whsec_`. The `standardwebhooks` libraries verify this directly:

```ts
import { Webhook } from "standardwebhooks";
const event = new Webhook(secret.slice("whsec_".length)).verify(rawBody, headers); // throws if invalid
```

**Delivery and retries.** A 2xx response within 10 seconds counts as delivered. Redirects aren't followed and count as failures. After a failure the delivery is retried after 1 minute, 5 minutes, 30 minutes, 2 hours, 8 hours and 24 hours, then marked `failed`. A `410 Gone` response disables the endpoint right away (this is how Zapier unsubscribes). Endpoints must point to a public address. Private, loopback and link-local hosts are rejected when saved and again when the URL resolves at send time.

Every instance runs a delivery worker that polls Postgres every 2 seconds. Deliveries are claimed with `for update skip locked` and a 2-minute lease, so two instances never send the same delivery at once. Recording an event also wakes the local worker, so new deliveries go out right away.

| Env var | Default | |
| --- | --- | --- |
| `WEBHOOKS_WORKER` | `true` | Set to `false` to skip running the delivery worker on this instance. |
| `WEBHOOKS_ALLOW_PRIVATE_URLS` | `false` | Set to `true` to allow localhost and private-network URLs, for local development only. |

## Deploy on Render

The repo's root [`render.yaml`](../render.yaml) is a Blueprint for this service (Docker), the dashboard and the Postgres database. This service gets `DATABASE_URL` from the database's internal URL and health-checks `/health`. When Render asks for `ADMIN_API_KEY`, use the legacy dashboard's existing value if it still needs to work, or a new random one. The new dashboard receives the same value automatically. Set `APP_URL` to the dashboard's public URL. Then move the `api.honeyapi.dev` custom domain to the new service.

### Moving data from the legacy API

```bash
UPSTASH_REDIS_REST_URL=… UPSTASH_REDIS_REST_TOKEN=… DATABASE_URL=<render external url> \
  bun run import:redis --dry-run      # then again without --dry-run
```

The import only reads from Redis and skips rows that already exist, so you can run it again just before cutover. Existing API and public keys carry over. Usage history from Tinybird isn't copied. Current usage counters are.

## Differences from the legacy API

The routes and their response shapes are the same. These behaviors changed:

- `/namespaces` search, `/count`, `/with-incentive`, `/plans/:id/namespaces` and `/analytics` always work now. The `503 … not configured` errors are gone.
- Search matches substrings (`ILIKE`). Typesense matched on prefixes and tolerated typos.
- `GET …/namespaces/:id/usage` returns `{ [entitlementId]: count }`. The legacy version had a bug that keyed the result by `[object Object]`.
- PATCH ignores `id` and `app_id`. On apps it also ignores `api_key`, `public_key` and `created_at`; use the regenerate routes to change keys.
- Malformed JSON bodies return `400`, missing `id` on create returns `400`, and unknown routes return a JSON `404`. All three used to be 500s or plain text.
- Deleting an app also deletes its plans, entitlements, addons, incentives, namespaces and usage. Deleting a namespace resets its usage counters but keeps its analytics events.
- Lists come back in creation order. Redis `KEYS` returned them in arbitrary order.
- New routes: `GET /health`, webhooks (see above), dashboard sign-in under `/api/auth/*` (admin key only), and analytics for the dashboard: `GET /apps/:appId/analytics/timeseries` (daily up to 60d, then weekly), `GET /apps/:appId/analytics/events` (newest first) and saved-report CRUD at `/apps/:appId/analytics/reports`.

## Layout

```
src/index.ts          server entry (migrate, Bun.serve, webhook worker)
src/app.ts            Hono app: middleware and route mounting
src/db/               Bun.sql client, migrator, JSONB doc store, namespace search
src/lib/              API-key auth, dashboard sign-in (better-auth), id generation, shared plan/incentive
                      attachment routes, plan resolution, webhooks (events, signing, delivery, worker), OpenAPI spec
src/routes/           one file per resource
migrations/           SQL migrations
scripts/import-redis.ts
```
