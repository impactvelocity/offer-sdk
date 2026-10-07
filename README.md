# offer-sdk

pnpm monorepo with four Next.js apps, plus a standalone Bun API:

| App | Path | Port | What |
| --- | --- | --- | --- |
| `offer-app` | [`offer-app/`](offer-app) | 6768 | **The dashboard**: talks to the API through its BFF, plus the React SDK source (`src/sdk`) |
| `web` | [`web/`](web) | 3000 | Marketing / sales site |
| `site` | [`site/`](site) | 6769 | Landing page, using the dashboard's dark design system |
| `blog` | [`blog/`](blog) | 6770 | **Test bed**: a Rails-tutorial-style blog that uses the API and SDK in every way, with a `rake test` page |
| `api` | [`api/`](api) | 6767 | Offer API (Hono + Bun + Postgres): all data plus dashboard sign-in. Not part of the pnpm workspace; see [`api/README.md`](api/README.md) |

## Getting started

```bash
pnpm install
pnpm dev:api      # Postgres + the API on :6767, in Docker
pnpm dev          # the dashboard (:6768), web (:3000), site (:6769) and blog (:6770)
```

**Explore the demo workspace** on the sign-in page builds the demo login (`demo@offersdk.dev` / `demo-password`) on first use, with two sample apps and six months of usage (`pnpm seed:demo --reset` rebuilds it). Local defaults line up with no `.env` files. The API uses `localhost` Postgres and the admin key `dev-admin-key`, and trusts dashboard origins on any localhost port. The dashboard calls `http://localhost:6767` with that key. Copy the `.env.example` files only to override something, such as adding `ANTHROPIC_API_KEY`.

To run the dashboard without the API, on an in-memory mock with a demo workspace, set `OFFER_API_URL=mock` in `offer-app/.env.local`.

## Deploy on Render

[`render.yaml`](render.yaml) is a Blueprint for the whole stack: the API (Docker), the dashboard (Node), a Render Workflows service for subscription pauses (`offersdk-workflows`) and a Postgres database. In Render, choose **New → Blueprint** and pick this repo.

```
browser ──► offer-app ── /api/admin/* (BFF) ──┐  Authorization: Bearer ADMIN_API_KEY
                      └─ /api/auth/*  (proxy) ─┴─► offersdk-api ──► Postgres
tenant code / SDK ───────────────────────────────► offersdk-api (app secret or public key)
offersdk-workflows ──────────────────────────────► offersdk-api (/pauses, admin key)
PayPal ──────────────────────────────────────────► offersdk-api (/paypal/webhooks/:appId)
```

- **Shared key.** `ADMIN_API_KEY` is set once on the API and copied to the dashboard as `OFFER_API_ADMIN_KEY`. The API rejects dashboard calls (`/orgs`, `/api/auth/*`, and any app as admin) without it.
- **Auth.** Users, sessions and workspaces are stored in Postgres by the API (`auth_*` tables). The dashboard forwards `/api/auth/*` to the API, so cookies are set on the dashboard's own domain.
- **URLs.** On the first deploy, Render asks for `APP_URL` (the dashboard's public URL, set on the API) and `OFFER_API_URL` (the API's public URL, set on the dashboard and the Workflows service). If you add custom domains later, update them. The dashboard reaches the API over Render's private network (`OFFER_API_INTERNAL_URL`, wired automatically).
- **Demo workspace.** The sign-in page offers **Explore the demo workspace** (`DEMO_ENABLED=true` in the blueprint). The first click builds the shared demo in the database. To undo visitors' changes, rebuild it from your machine. The script signs in through the dashboard like a browser, so it needs only the dashboard's URL.

  ```bash
  APP_URL=https://offer-app.onrender.com pnpm seed:demo --reset
  ```

- **PayPal webhooks.** Each app connects its own PayPal account in the dashboard, and the API registers PayPal's webhook at that moment. On Render it uses the API's `onrender.com` address (`RENDER_EXTERNAL_URL`), so there's nothing to set. Set `PUBLIC_API_URL` on the API to register a custom domain instead, or when hosting elsewhere.
- **Secrets.** `BETTER_AUTH_SECRET` is generated on the API. `ANTHROPIC_API_KEY` is optional: on the dashboard it enables the Agent page, and on the API it enables dynamic save offers in cancel flows. `RENDER_API_KEY` on the API, also optional, runs pauses on the Workflows service; without it the API pauses and resumes subscriptions itself.

## Scripts

- `pnpm dev`: run both apps
- `pnpm dev:app` / `pnpm dev:web` / `pnpm dev:site` / `pnpm dev:blog`: run one app
- `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`: run across all apps
