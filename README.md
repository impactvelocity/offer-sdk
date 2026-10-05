# offer-sdk

pnpm monorepo with three Next.js apps, plus a standalone Bun API:

| App | Path | Port | What |
| --- | --- | --- | --- |
| `offer-app` | [`offer-app/`](offer-app) | 6768 | **The dashboard**: talks to the API through its BFF, plus the React SDK source (`src/sdk`) |
| `web` | [`web/`](web) | 3000 | Marketing / sales site |
| `site` | [`site/`](site) | 6769 | Landing page, using the dashboard's dark design system |
| `api` | [`api/`](api) | 6767 | Offer API (Hono + Bun + Postgres): all data plus dashboard sign-in. Not part of the pnpm workspace; see [`api/README.md`](api/README.md) |

## Getting started

```bash
pnpm install
pnpm dev:api      # Postgres + the API on :6767, in Docker
pnpm dev          # the dashboard (:6768), web (:3000) and site (:6769)
```

`pnpm seed:demo` adds the demo login (`demo@offersdk.dev` / `demo-password`) with two sample apps and six months of usage. Local defaults line up with no `.env` files. The API uses `localhost` Postgres and the admin key `dev-admin-key`, and trusts dashboard origins on any localhost port. The dashboard calls `http://localhost:6767` with that key. Copy the `.env.example` files only to override something, such as adding `ANTHROPIC_API_KEY`.

To run the dashboard without the API, on an in-memory mock with a demo workspace, set `OFFER_API_URL=mock` in `offer-app/.env.local`.

## Deploy on Render

[`render.yaml`](render.yaml) is a Blueprint for the whole stack: the API (Docker), the dashboard (Node) and a Postgres database. In Render, choose **New → Blueprint** and pick this repo.

```
browser ──► offer-app ── /api/admin/* (BFF) ──┐  Authorization: Bearer ADMIN_API_KEY
                      └─ /api/auth/*  (proxy) ─┴─► honeypot-api ──► Postgres
tenant code / SDK ───────────────────────────────► honeypot-api (app secret or public key)
```

- **Shared key.** `ADMIN_API_KEY` is set once on the API and copied to the dashboard as `OFFER_API_ADMIN_KEY`. The API rejects dashboard calls (`/orgs`, `/api/auth/*`, and any app as admin) without it.
- **Auth.** Users, sessions and workspaces are stored in Postgres by the API (`auth_*` tables). The dashboard forwards `/api/auth/*` to the API, so cookies are set on the dashboard's own domain.
- **URLs.** On the first deploy, Render asks for `APP_URL` (the dashboard's public URL, set on the API) and `OFFER_API_URL` (the API's public URL, set on the dashboard). If you add custom domains later, update both. The dashboard reaches the API over Render's private network (`OFFER_API_INTERNAL_URL`, wired automatically).
- **Demo workspace.** After the first deploy, seed the shared demo from your machine. The script signs in through the dashboard like a browser, so it needs only the dashboard's URL. The sign-in page then offers **Explore the demo workspace** (`DEMO_ENABLED=true` in the blueprint).

  ```bash
  APP_URL=https://offer-app.onrender.com pnpm seed:demo
  ```

- **Secrets.** `BETTER_AUTH_SECRET` is generated on the API. `ANTHROPIC_API_KEY` is optional and enables the Agent page.

## Scripts

- `pnpm dev`: run both apps
- `pnpm dev:app` / `pnpm dev:web` / `pnpm dev:site`: run one app
- `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`: run across all apps
