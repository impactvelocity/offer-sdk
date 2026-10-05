# offer-app

The hosted dashboard for the Offer API: entitlements, plans, add-ons, incentives, accounts and usage, managed per app and per workspace. It also hosts the React SDK source (`src/sdk`).

```bash
cp .env.example .env.local
pnpm dev     # http://localhost:3001
pnpm test    # vitest: API routes, SDK client, mock Offer API
```

`pnpm dev` connects to the API on `http://localhost:6767` with its development key, so no `.env` is needed. Start the API with `pnpm dev:api` from the repo root (Postgres and the API in Docker). Then sign up, or run `pnpm seed:demo` and use **Explore the demo workspace**.

### Demo workspace

`pnpm seed:demo` (from the root or here) creates the shared demo login (`demo@offersdk.dev` / `demo-password`) and its Acme Labs workspace. The workspace holds two sample apps, Notebook AI (SaaS) and Course Hub (course), with catalogs, accounts that signed up over six months, months of usage and saved reports. It drives the dashboard like a browser, so it only needs `APP_URL` (default `http://localhost:6768`). The catalog comes from the dashboard's "Start with sample data". The script generates the history and sends it to the API's admin-only `POST /apps/:appId/import` through the BFF.

- It's safe to re-run. It leaves existing demo apps alone, and `pnpm seed:demo --reset` rebuilds them after visitors have changed things.
- `DEMO_ENABLED=true` shows the demo button on the sign-in page. It's on by default under `next dev`, and the mock always has its own in-memory demo.
- The API stops the shared account from changing its profile, password or sessions, and from managing the workspace or its members. Everything inside the apps stays editable.

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

## Deploy

The root [`render.yaml`](../render.yaml) deploys this app and the API as two Render services that share `ADMIN_API_KEY`. See the [root README](../README.md#deploy-on-render).

## Layout

```
src/
├── app/
│   ├── (auth)/                     sign-in, sign-up
│   ├── (protected)/
│   │   ├── onboarding/             create a workspace
│   │   └── (workspace)/
│   │       ├── apps/               apps in the workspace
│   │       │   └── [appId]/        overview, analytics, plans, entitlements, add-ons, incentives,
│   │       │                       accounts, developers (integration, API reference, keys), settings
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
| `DEMO_ENABLED` | Show **Explore the demo workspace** on sign-in with the hosted API (seed it with `pnpm seed:demo`). Defaults to `true` under `next dev`. |
| `BETTER_AUTH_SECRET` | Mock mode only: session signing secret (a dev fallback is used locally). With the hosted API, set it on the API. |
| `BETTER_AUTH_URL` | Mock mode only: public URL of this app. When unset, it's inferred from the request. |
| `CORS_ORIGINS` | Origins allowed to call the public `/api/*` routes. |
