# offer-app

The hosted dashboard for the Offer API: entitlements, plans, add-ons, incentives, accounts and usage, managed per app and per workspace. It also hosts the React SDK source (`src/sdk`).

```bash
cp .env.example .env.local
pnpm dev     # http://localhost:3001
pnpm test    # vitest: API routes, SDK client, mock Offer API
```

`pnpm dev` connects to the API on `http://localhost:6767` with its development key, so no `.env` is needed. Start the API with `pnpm dev:api` from the repo root (Postgres and the API in Docker). Then sign up, or use **Explore the demo workspace**.

### Demo workspace

With `DEMO_ENABLED=true` (the default under `next dev`, and set in `render.yaml`), the sign-in page shows the demo login with a **Fill in** button, and **Explore the demo workspace**. `/demo-account` opens sign-in with the login already filled in, which makes a good link for judges and visitors. The first sign-in builds the shared demo login (`demo@offersdk.dev` / `demo-password`) and its Acme Labs workspace (`POST /api/demo-workspace`, `src/server/demo.ts`), which takes a few seconds. The workspace holds two sample apps, Notebook AI (SaaS) and Course Hub (course), with catalogs, accounts that signed up over six months, months of usage, saved reports, and on Notebook AI a draft offer and a live cancel flow. The catalog is the dashboard's "Start with sample data", which also imports the generated history through the API's admin-only `POST /apps/:appId/import`.

- The demo is built again whenever its workspace has no apps. `pnpm seed:demo` (from the root or here) builds the demo ahead of the first click, and only needs `APP_URL` (default `http://localhost:6768`). `--reset` deletes the apps and rebuilds them through `POST /api/demo-workspace` with `{ "reset": true }`. It needs the admin key, because the demo login is read-only, so set `ADMIN_API_KEY` for a deployed dashboard. Locally it defaults to `dev-admin-key`.
- The mock always has its own in-memory demo (no offers or cancel flow, which the mock doesn't have).
- The shared login is read-only (`src/lib/demo.ts`), and every page shows a banner saying so. The BFF refuses its changes, apart from the offer and cancel-flow previews. The Agent page and `/api/agent` are off for it, so visitors can't spend your `ANTHROPIC_API_KEY`. `/api/auth` and the API both stop it from changing its profile, password or sessions, and from creating or managing workspaces and members. The API also refuses writes made with the demo apps' secret keys, since the dashboard shows those keys. Public keys and account tokens keep working, so checkouts and cancel flows run as usual.

To work without the API, set `OFFER_API_URL=mock` in `.env.local`. The app then runs on an in-memory mock. Sign in with **Explore the demo workspace** (`demo@offersdk.dev` / `demo-password`), which is seeded with two sample apps (a SaaS and an online course) and three months of usage history. Builds and tests always use the mock unless `OFFER_API_URL` is set.

## How it fits together

```
browser ──► /api/admin/*  (BFF: session + workspace check)  ──►  Offer API
        └─► /api/auth/*   (better-auth)                     ──►  ├─ OFFER_API_URL set → hosted API (../api) with the admin key
                                                                 └─ unset             → in-memory mock + in-process auth
```

- **UI → BFF.** Screens call `/api/admin/...` through `src/lib/api/client.ts` (typed) and `src/lib/api/hooks.ts` (TanStack Query). App routes are forwarded with the hosted API's paths unchanged, so nothing in the UI changes when you switch from the mock to the real API.
- **Authorization.** The BFF only forwards `/apps/:appId/*` when the app belongs to the signed-in user's active workspace. It maps the workspace to an API org (created on first use) and keeps the org's `app_ids` in sync on create and delete.
- **Mock API.** `src/server/offer-api/mock` re-implements the hosted API in memory: the same routes, status codes, slug rules, shallow-merge PATCH and key permissions (tests in `test/mock-api.test.ts`). It's also exposed at `/api/mock/*`, which accepts an app's real secret and public keys, so snippets, curl and the API reference's "Try it" work locally. Data resets when the server restarts.
- **Auth.** [better-auth](https://better-auth.com) with email/password and the organization plugin, which provides workspaces, members, roles and invitations. `src/server/auth` hides where it runs. With the hosted API, better-auth runs in the API on Postgres, and this app forwards `/api/auth/*` to it with the admin key (`remote.ts`). The browser only ever talks to this app, so session cookies stay first-party. With the mock, better-auth runs in this process on an in-memory store (`local.ts`). Invitations are recorded but not emailed: an invited email gets access when it signs up (or, with the hosted API, signs in).

### Dashboard-only endpoints

The usage charts, activity feeds and saved reports use `GET /apps/:appId/analytics/timeseries`, `GET /apps/:appId/analytics/events` and `/apps/:appId/analytics/reports`. Both the mock and the hosted API serve them. Against an older API without them, the UI hides those parts (the client returns `null` on a 404).

### MCP server

The MCP server runs in the API (`../api/src/mcp`, one per app at `/apps/:appId/mcp`); this app only configures it. Developers → MCP server reads and writes its settings, connections and call log through the BFF (admin-only `/apps/:appId/mcp/*` routes). OAuth clients like Claude and Cursor are sent to `/oauth/consent` here to sign in and approve; the form posts to `/oauth/consent/decide`, which checks the person belongs to the app's workspace before the API issues a code. The tools come from the API reference (`src/components/developers/mcp-tools.ts`): after changing `endpoints.ts` or the tool names, run `pnpm mcp:tools` to rewrite `../api/src/mcp/tools.json` (`test/mcp-tools.test.ts` fails while it's stale). Against the mock there is no server, so the page previews with sample data.

## Deploy

The root [`render.yaml`](../render.yaml) deploys this app and the API as two Render services that share `ADMIN_API_KEY`. See the [root README](../README.md#deploy-on-render).

## Layout

```
src/
├── app/
│   ├── (auth)/                     sign-in, sign-up, MCP OAuth consent
│   ├── (protected)/
│   │   ├── onboarding/             create a workspace
│   │   └── (workspace)/
│   │       ├── apps/               apps in the workspace
│   │       │   └── [appId]/        overview, analytics, plans, entitlements, add-ons, incentives,
│   │       │                       accounts, developers (integration, API reference, MCP, keys), settings
│   │       └── settings/           workspace, members, profile
│   └── api/
│       ├── admin/[...path]/        BFF for the dashboard
│       ├── auth/[...all]/          better-auth
│       ├── mock/[...path]/         the mock Offer API, with API-key auth
│       └── v1/offers, health/      public API (SDK)
├── components/
│   ├── ui/                         Base UI primitives styled in the Attio idiom
│   ├── shell/                      rail, nav panels, page header, ⌘K quick actions
│   ├── catalog/                    shared record-page pieces (editors, dialogs, record layout)
│   └── analytics/, charts/, …      feature components
├── lib/                            API client + hooks, auth client, utilities
├── server/                         env, auth, Offer API gateway + mock + sample data
└── sdk/                            React SDK
```

## Design

- **Type.** [Cal Sans](https://cal.com/font) (the variable font from the `cal-sans` package, loaded with `next/font/local`), using the UI geometry (`GEOM 25`) for interface text.
- **Components.** [Base UI](https://base-ui.com) primitives, styled with tokens in `src/app/globals.css`. Use the tokens (`text-fg-secondary`, `border-border`, `bg-bg-subtle`, `accent`…), not raw palette colors.
- **Shell.** Dub's three columns: an icon rail (workspace, one tile per app, settings and account), a nav panel for the current app or workspace, and the page on a white card. Below `md`, the rail and panel collapse into a drawer.
- **Idiom.** Inside the page, Attio's: a 14px base size with roomy spacing, hairline grids, a 56px page header with a toolbar, and record pages with a details panel.
- **Themes.** Light and dark. Every color is a CSS variable in `src/app/globals.css`, swapped under `[data-theme="dark"]`. The preference (System, Light or Dark) lives in `localStorage` (`src/lib/theme.ts`), and an inline script in the root layout applies it before first paint. Toggles are in the rail, the account menu, Profile → Appearance and ⌘K. Use tokens (including `tag-*`, `code-*`, `bg-elevated`, `--series-*`), never raw hex, so both themes work.
- **Color.** Blue (`accent`) for actions and active states. The violet→pink brand gradient (`--brand-from`/`--brand-to`, the `bg-brand`, `bg-brand-soft` and `text-brand` utilities) is used sparingly, as a pop of color in charts, sparklines, bar lists and progress. Chart series lead with the brand violet (`src/components/charts/palette.ts`, validated for colorblind separation).

## Environment

| Var | |
| --- | --- |
| `OFFER_API_URL` | Offer API public URL (shown in snippets). Defaults to `http://localhost:6767` under `next dev`. `mock`, or unset elsewhere, uses the mock. |
| `OFFER_API_ADMIN_KEY` | The API's `ADMIN_API_KEY`, required with `OFFER_API_URL` (defaults to `dev-admin-key` under `next dev`). It authenticates the BFF and the auth proxy. In mock mode, it's the admin key `/api/mock` accepts; when unset, that key is random per process. |
| `OFFER_API_INTERNAL_URL` | Optional private address this server uses to reach the API, such as Render's `host:port`. Defaults to `OFFER_API_URL`. |
| `DEMO_ENABLED` | Show **Explore the demo workspace** on sign-in with the hosted API. The first click builds the demo workspace. Defaults to `true` under `next dev`. |
| `BETTER_AUTH_SECRET` | Mock mode only: session signing secret (a dev fallback is used locally). With the hosted API, set it on the API. |
| `BETTER_AUTH_URL` | Mock mode only: public URL of this app. When unset, it's inferred from the request. |
| `CORS_ORIGINS` | Origins allowed to call the public `/api/*` routes. |
