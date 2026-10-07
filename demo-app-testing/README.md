# demo-app-testing

The Rails blog tutorial, rebuilt on Next.js as a test bed for the Offer API and SDK. Posts and comments are scaffolded and styled like Rails 3 (`scaffold.css`, the red `error_explanation`, "Welcome aboard"), and every feature runs through the API: each user is an Offer account, posts are a metered entitlement with a hard limit, and the pricing page is the checkout SDK.

```bash
pnpm dev:api          # from the repo root: Postgres + the Offer API on :6767
pnpm dev:demo         # http://localhost:6770
```

Then open **/setup** and press *rails generate offer:install*. It creates the app (`POST /apps`) and its catalog through the API, and saves the keys in the blog's database. Sign up, write posts, and run **/console** (`rake test`).

## Database

SQLite at `./blog.sqlite3` by default. To run auth (better-auth) and the blog's tables on Postgres instead:

```bash
pnpm db:postgres      # Postgres 17 on :5434 (docker-compose.yml here)
DATABASE_URL=postgres://postgres:postgres@localhost:5434/blog pnpm dev
```

Tables are created on boot (`src/instrumentation.ts`): better-auth's migrations, then `posts`, `comments`, `offer_settings` and `webhook_events`. Each database has its own connected app, so run /setup once per database.

## What it exercises

| Where | API / SDK |
| --- | --- |
| **/setup** | `POST /apps` (no key), entitlements, add-ons, plans with attachments and private meta, incentive, offers, webhook endpoint, optional PayPal connect + publish, and `PATCH /orgs/:id` (admin key) to show the app in a dashboard workspace |
| **Posts** | `usage/posts/add` on create, which returns a 402 with an upgrade offer past the Free plan's 3 posts (`overage: block`). `usage/posts/remove` on destroy. Pinning checks the `pin_posts` boolean |
| **Comments** | Soft limit: checks `can` on `/plan`, then `usage/comments/add` on the post author's account |
| **My account** | `/plan` and `/full-plan`, usage add/remove/amount, plan change, promo code → incentive (with expiry), account add-ons, subscription sync/cancel, delete account. Also the core SDK in the browser (`<OfferProvider>`, `useOfferClient`) with the publishable key, including the 401s it should get |
| **Pricing** | Checkout SDK: `getOffer()` on the server, `<OfferProvider>`, every `Offer.*` component, `useOffer()`, `redirectToPaypal()`. `?preview=1` renders a draft via `POST /offers/draft-preview`. `/plans/pricing` with the publishable key |
| **Offers** | List, show, `preview` for your account, `stats`, create shareable and targeted offers, publish, archive, delete, `/checkouts` |
| **Webhooks** | Receiver at `/api/webhooks`, verified with `standardwebhooks`. The page sends test events, toggles the endpoint, rotates the secret, and lists deliveries (with retry) and `/events`. *Break local secret* makes deliveries fail with 401, so you can watch retries |
| **Stats** | `/analytics`, `timeseries`, `top-namespaces`, `analytics/events`, saved reports, namespace search, `count`, `with-incentive`, `/plans/:id/namespaces` |
| **rake test** | ~100 checks over all of the above, plus the auth rules for each key type and the SDK helpers. It uses a throwaway account and cleans up after itself. Headless: `curl -s localhost:6770/api/rake \| jq .summary`, which returns HTTP 500 when anything fails |

The bottom of each page shows a "development.log" with every Offer API call made to render it, and which key it used.

Server code reaches the API through the SDK's own `OfferClient.request` (`src/lib/offer/client.ts`). The SDK is imported straight from `../offer-app/src/sdk` through tsconfig paths (`@offer/sdk`, `@offer/sdk/checkout`), so SDK changes show up here right away.

## Without PayPal

Offers stay drafts, because publishing needs a PayPal connection. Use `/pricing?offer=launch_50&preview=1` to see one through the SDK anyway. The rake tests expect the 409s that go with this. Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` (sandbox) and re-run /setup to connect PayPal and publish.

## Env

Everything has a local default; see `.env.example`. Webhooks are delivered to `http://host.docker.internal:6770/api/webhooks`, because the API runs in Docker. Set `OFFER_WEBHOOK_URL` if yours doesn't.
