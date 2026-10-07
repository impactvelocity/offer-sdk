import type { EndpointDoc } from "@/components/docs/prose";

/*
 * Every route the Offer API serves, grouped by resource. Derived from the mounts in
 * api/src/app.ts and the handlers in api/src/routes/*.ts. `auth` names the narrowest
 * credentials that work; the admin key also works on every /apps/:appId route.
 */

export type EndpointGroup = { title: string; intro?: string; endpoints: EndpointDoc[] };

const NONE = "No credential";
const SECRET = "Secret key";
const PUBLIC = "Secret or publishable key";
const ACCOUNT_READ = "Secret key, publishable key, or the account's own token";
const ACCOUNT_PRIVATE = "Secret key, or the account's own token";
const ACCOUNT_TOKEN = "Secret key or the account's own token";
const ADMIN = "Admin key only";

const MCP_AUTH = "Secret key, or an OAuth access token for this app";

const app = "/apps/:appId";
const account = `${app}/namespaces/:accountId`;

/** The MCP server and the OAuth routes its clients call. Also listed on /docs/api/mcp. */
export const MCP_ENDPOINTS: EndpointDoc[] = [
  {
    method: "POST",
    path: `${app}/mcp`,
    summary: "The app's MCP server: one JSON-RPC message (or a batch) per request, answered with JSON. 401 points to the resource metadata; 403 when the server is turned off.",
    auth: MCP_AUTH,
  },
  { method: "GET", path: `${app}/mcp`, summary: "405. The server is stateless and never streams to the client.", auth: NONE },
  { method: "DELETE", path: `${app}/mcp`, summary: "405. There is no session to end.", auth: NONE },
  {
    method: "GET",
    path: "/.well-known/oauth-protected-resource/apps/:appId/mcp",
    summary: "Protected resource metadata (RFC 9728): the server URL, its authorization server and scopes.",
    auth: NONE,
  },
  { method: "GET", path: "/.well-known/oauth-protected-resource", summary: "The same, for clients that drop the path. The resource is the API's origin.", auth: NONE },
  {
    method: "GET",
    path: "/.well-known/oauth-authorization-server",
    summary: "Authorization server metadata (RFC 8414). Also served under /.well-known/oauth-authorization-server/* and /.well-known/openid-configuration.",
    auth: NONE,
  },
  {
    method: "POST",
    path: "/oauth/register",
    summary: "Dynamic client registration (RFC 7591). Body: { redirect_uris, client_name?, token_endpoint_auth_method?, client_uri?, logo_uri? }.",
    auth: NONE,
  },
  {
    method: "GET",
    path: "/oauth/authorize",
    summary: "Starts an authorization code request with PKCE (S256) and redirects to the dashboard's consent page.",
    auth: NONE,
  },
  {
    method: "POST",
    path: "/oauth/token",
    summary: "grant_type authorization_code (with code_verifier) or refresh_token. Refresh tokens rotate on every use.",
    auth: "Client id, plus its secret for confidential clients",
  },
  { method: "POST", path: "/oauth/revoke", summary: "Revokes an access or refresh token (RFC 7009), which ends the connection.", auth: "Client id, plus its secret for confidential clients" },
];

/** The dashboard's routes for the MCP page and the consent page. */
export const MCP_ADMIN_ENDPOINTS: EndpointDoc[] = [
  { method: "GET", path: `${app}/mcp/settings`, summary: "The server's settings: enabled, access_level and tool_overrides.", auth: ADMIN },
  {
    method: "PATCH",
    path: `${app}/mcp/settings`,
    summary: "Updates enabled, access_level (read, write or full) or tool_overrides, a map of tool name to true or false that replaces the old one.",
    auth: ADMIN,
  },
  { method: "GET", path: `${app}/mcp/connections`, summary: "Connected clients, most recently used first, with tool calls in the last 7 days.", auth: ADMIN },
  {
    method: "DELETE",
    path: `${app}/mcp/connections/:connectionId`,
    summary: "Removes a connection. An OAuth connection loses access on its next call.",
    auth: ADMIN,
  },
  { method: "GET", path: `${app}/mcp/calls`, summary: "Tool calls, newest first, kept 30 days. Query: connection_id, limit.", auth: ADMIN },
  { method: "GET", path: "/oauth/requests/:requestId", summary: "A pending authorization request, for the consent page. 404 once used or expired.", auth: ADMIN },
  {
    method: "POST",
    path: "/oauth/requests/:requestId/approve",
    summary: "Approves a request. Body: { user: { id, name?, email? }, access_level, app_id? }. Returns redirect_url with the code.",
    auth: ADMIN,
  },
  { method: "POST", path: "/oauth/requests/:requestId/deny", summary: "Denies a request. Returns redirect_url with error=access_denied.", auth: ADMIN },
];

export const ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    title: "Service",
    endpoints: [
      { method: "GET", path: "/", summary: "Plain-text banner, to check the service is up.", auth: NONE },
      { method: "GET", path: "/health", summary: "Runs a query against Postgres and returns { ok: true }. Render's health check.", auth: NONE },
      { method: "GET", path: "/openapi.json", summary: "The OpenAPI 3.1 document. Covers the core routes only.", auth: NONE },
      { method: "GET", path: "/docs", summary: "Interactive API reference rendered from /openapi.json.", auth: NONE },
      { method: "GET", path: "/event-types", summary: "The webhook event catalog, with a sample data payload for each type.", auth: NONE },
    ],
  },
  {
    title: "Apps",
    intro: "An app is one product you sell. Creating one returns its secret and publishable keys.",
    endpoints: [
      { method: "POST", path: "/apps", summary: "Creates an app. Body: { name, plan? }. Returns the app with api_key and public_key.", auth: ADMIN },
      { method: "GET", path: app, summary: "The app record, including its keys and checkout_url.", auth: SECRET },
      { method: "PATCH", path: app, summary: "Merges fields into the app, such as name or checkout_url. Key fields are ignored.", auth: SECRET },
      { method: "DELETE", path: app, summary: "Deletes the app and every plan, entitlement, add-on, incentive, account and counter in it.", auth: SECRET },
      { method: "POST", path: `${app}/keys/regenerate`, summary: "Replaces the secret key. Also revokes every account token.", auth: SECRET },
      { method: "POST", path: `${app}/public-key/regenerate`, summary: "Replaces the publishable key.", auth: SECRET },
    ],
  },
  {
    title: "Accounts",
    intro: "Accounts are your customers, keyed by an id you choose. In paths they are called namespaces.",
    endpoints: [
      {
        method: "GET",
        path: `${app}/namespaces`,
        summary: "Searches accounts. Query: q, plan, incentive, offer, has_incentive, page, per_page.",
        auth: SECRET,
      },
      { method: "GET", path: `${app}/namespaces/count`, summary: "Number of accounts in the app.", auth: SECRET },
      { method: "GET", path: `${app}/namespaces/with-incentive`, summary: "Accounts that have an incentive. Query: incentive, page, per_page.", auth: SECRET },
      { method: "POST", path: `${app}/namespaces`, summary: "Creates an account. Body: { id, name?, plan, incentive? }. 409 if the id exists.", auth: SECRET },
      { method: "GET", path: account, summary: "The account record, with its subscription and own add-ons.", auth: SECRET },
      {
        method: "PATCH",
        path: account,
        summary: "Merges fields into the account: name, plan, incentive, incentive_expires_at. Changes the plan without payment.",
        auth: SECRET,
      },
      { method: "DELETE", path: account, summary: "Deletes the account and its usage counters. Usage history stays for analytics.", auth: SECRET },
      { method: "DELETE", path: `${account}/incentive`, summary: "Removes the account's incentive.", auth: SECRET },
      { method: "POST", path: `${account}/token`, summary: "Mints an account token (act_…). Body: { ttl_seconds? }, 60 to 86,400.", auth: SECRET },
      {
        method: "GET",
        path: `${account}/plan`,
        summary: "Effective access: plan, offer extras and incentive merged, with usage, max, left and can per entitlement. Private meta removed.",
        auth: ACCOUNT_READ,
      },
      { method: "GET", path: `${account}/full-plan`, summary: "Same as /plan, with private meta included.", auth: ACCOUNT_PRIVATE },
      { method: "POST", path: `${account}/addons`, summary: "Gives the account an add-on of its own. Body: { id }.", auth: SECRET },
      { method: "DELETE", path: `${account}/addons/:addonId`, summary: "Removes an add-on the account owns.", auth: SECRET },
    ],
  },
  {
    title: "Usage",
    intro: "Counters for usage entitlements. Calls on a boolean entitlement return 400.",
    endpoints: [
      { method: "GET", path: `${account}/usage`, summary: "Counts for every entitlement on the account's plan, as { [entitlementId]: count }.", auth: PUBLIC },
      { method: "GET", path: `${account}/usage/:entitlementId`, summary: "One counter: { entitlement, count }.", auth: PUBLIC },
      { method: "POST", path: `${account}/usage/:entitlementId/add`, summary: "Adds 1. Returns 402 with an upgrade offer when a blocking limit would be passed.", auth: PUBLIC },
      { method: "POST", path: `${account}/usage/:entitlementId/remove`, summary: "Subtracts 1.", auth: SECRET },
      { method: "POST", path: `${account}/usage/:entitlementId/amount`, summary: "Adds { amount } (an integer, negative to subtract). Positive amounts can return 402. A negative amount with the publishable key returns 403.", auth: PUBLIC },
    ],
  },
  {
    title: "Plans",
    endpoints: [
      { method: "GET", path: `${app}/plans`, summary: "Every plan, in creation order.", auth: SECRET },
      { method: "GET", path: `${app}/plans/pricing`, summary: "Pricing cards of the plans that have one, for a pricing table.", auth: PUBLIC },
      { method: "POST", path: `${app}/plans`, summary: "Creates a plan. Body: { id, name, description?, note?, isFree?, pricingCard? }.", auth: SECRET },
      { method: "GET", path: `${app}/plans/:planId`, summary: "One plan.", auth: SECRET },
      { method: "PATCH", path: `${app}/plans/:planId`, summary: "Merges fields into the plan, including privateMetaKeys.", auth: SECRET },
      { method: "DELETE", path: `${app}/plans/:planId`, summary: "Deletes the plan.", auth: SECRET },
      { method: "GET", path: `${app}/plans/:planId/pricing`, summary: "One plan's pricing card. 404 when it has none.", auth: PUBLIC },
      { method: "PATCH", path: `${app}/plans/:planId/meta`, summary: "Merges keys into the plan's meta.", auth: SECRET },
      { method: "GET", path: `${app}/plans/:planId/namespaces`, summary: "Accounts on the plan. Query: page, per_page.", auth: SECRET },
      { method: "POST", path: `${app}/plans/:planId/entitlements`, summary: "Attaches an entitlement. Body: { id, max? }. max: null means unlimited.", auth: SECRET },
      { method: "PATCH", path: `${app}/plans/:planId/entitlements/:entitlementId`, summary: "Changes an attached entitlement's limit. Body: { max }.", auth: SECRET },
      { method: "DELETE", path: `${app}/plans/:planId/entitlements/:entitlementId`, summary: "Detaches an entitlement.", auth: SECRET },
      { method: "POST", path: `${app}/plans/:planId/addons`, summary: "Attaches an add-on. Body: { id }.", auth: SECRET },
      { method: "DELETE", path: `${app}/plans/:planId/addons/:addonId`, summary: "Detaches an add-on.", auth: SECRET },
      {
        method: "POST",
        path: `${app}/plans/:planId/checkout`,
        summary: "Starts a PayPal checkout for the plan at its regular price. Body: { interval?, account? | email?, ref?, return_url?, cancel_url? }.",
        auth: PUBLIC,
      },
    ],
  },
  {
    title: "Entitlements",
    endpoints: [
      { method: "GET", path: `${app}/entitlements`, summary: "Every entitlement.", auth: SECRET },
      { method: "POST", path: `${app}/entitlements`, summary: "Creates an entitlement. Body: { id, type: usage | boolean, name, description? }.", auth: SECRET },
      { method: "GET", path: `${app}/entitlements/:entitlementId`, summary: "One entitlement.", auth: SECRET },
      {
        method: "PATCH",
        path: `${app}/entitlements/:entitlementId`,
        summary: "Updates it. overage: { mode: allow | block, offer_id? } makes the API refuse usage past the limit with a 402.",
        auth: SECRET,
      },
      { method: "DELETE", path: `${app}/entitlements/:entitlementId`, summary: "Deletes the entitlement.", auth: SECRET },
    ],
  },
  {
    title: "Add-ons",
    endpoints: [
      { method: "GET", path: `${app}/addons`, summary: "Every add-on.", auth: SECRET },
      { method: "POST", path: `${app}/addons`, summary: "Creates an add-on. Body: { id, name, description? }.", auth: SECRET },
      { method: "GET", path: `${app}/addons/:addonId`, summary: "One add-on.", auth: SECRET },
      { method: "PATCH", path: `${app}/addons/:addonId`, summary: "Updates the add-on.", auth: SECRET },
      { method: "DELETE", path: `${app}/addons/:addonId`, summary: "Deletes the add-on.", auth: SECRET },
    ],
  },
  {
    title: "Incentives",
    intro: "An incentive overrides limits and adds add-ons on top of an account's plan, such as a promo code or a partner deal.",
    endpoints: [
      { method: "GET", path: `${app}/incentives`, summary: "Every incentive.", auth: SECRET },
      { method: "POST", path: `${app}/incentives`, summary: "Creates an incentive. Body: { id, name, description?, entitlements?, addons? }.", auth: SECRET },
      { method: "GET", path: `${app}/incentives/:incentiveId`, summary: "One incentive.", auth: SECRET },
      { method: "PATCH", path: `${app}/incentives/:incentiveId`, summary: "Updates the incentive.", auth: SECRET },
      { method: "DELETE", path: `${app}/incentives/:incentiveId`, summary: "Deletes the incentive.", auth: SECRET },
      { method: "POST", path: `${app}/incentives/:incentiveId/entitlements`, summary: "Adds an entitlement override. Body: { id, max? }.", auth: SECRET },
      { method: "PATCH", path: `${app}/incentives/:incentiveId/entitlements/:entitlementId`, summary: "Changes an override's limit. Body: { max }.", auth: SECRET },
      { method: "DELETE", path: `${app}/incentives/:incentiveId/entitlements/:entitlementId`, summary: "Removes an override.", auth: SECRET },
      { method: "POST", path: `${app}/incentives/:incentiveId/addons`, summary: "Adds an add-on. Body: { id }.", auth: SECRET },
      { method: "DELETE", path: `${app}/incentives/:incentiveId/addons/:addonId`, summary: "Removes an add-on.", auth: SECRET },
    ],
  },
  {
    title: "Offers",
    intro: "Offers sell plans at a price, with extras and order bumps. Publishing needs PayPal connected.",
    endpoints: [
      { method: "GET", path: `${app}/offers`, summary: "Every offer, with live status and completed redemptions.", auth: SECRET },
      {
        method: "POST",
        path: `${app}/offers`,
        summary: "Creates a draft offer. Shareable offers need an id (their slug); targeted offers take an account_id and get an unguessable id.",
        auth: SECRET,
      },
      { method: "GET", path: `${app}/offers/:offerId`, summary: "One offer as the dashboard sees it.", auth: SECRET },
      { method: "PATCH", path: `${app}/offers/:offerId`, summary: "Edits the offer. Applies to future purchases only.", auth: SECRET },
      { method: "DELETE", path: `${app}/offers/:offerId`, summary: "Deletes the offer. Buyers keep their price and extras.", auth: SECRET },
      { method: "POST", path: `${app}/offers/draft-preview`, summary: "Validates unsaved offer fields and returns the public view a checkout page would show. Stores nothing.", auth: SECRET },
      { method: "POST", path: `${app}/offers/:offerId/publish`, summary: "Creates the PayPal billing plans and makes the offer active.", auth: SECRET },
      { method: "POST", path: `${app}/offers/:offerId/archive`, summary: "Stops new purchases. Existing buyers keep their terms.", auth: SECRET },
      {
        method: "POST",
        path: `${app}/offers/:offerId/preview`,
        summary: "What each plan in the offer grants. Body: { account? } adds what would change for that account.",
        auth: SECRET,
      },
      { method: "GET", path: `${app}/offers/:offerId/stats`, summary: "Views, checkouts, conversion and revenue, by plan, by ref and by bump.", auth: SECRET },
      {
        method: "GET",
        path: `${app}/offers/:offerId/public`,
        summary: "The offer a checkout page should show, falling back to fallback, then regular prices. Query: fallback, account, ref. Never 404.",
        auth: PUBLIC,
      },
      {
        method: "POST",
        path: `${app}/offers/:offerId/checkout`,
        summary: "Prices the selection on the server and creates the PayPal subscription or order. Body: { plan, interval, bumps?, account? | email?, ref?, return_url?, cancel_url? }.",
        auth: PUBLIC,
      },
    ],
  },
  {
    title: "Checkouts",
    endpoints: [
      { method: "GET", path: `${app}/checkouts`, summary: "Recent checkouts, newest first. Query: offer, status, limit.", auth: SECRET },
      { method: "GET", path: `${app}/checkouts/:checkoutId`, summary: "One checkout.", auth: PUBLIC },
      {
        method: "POST",
        path: `${app}/checkouts/:checkoutId/complete`,
        summary: "Checks the payment with PayPal and applies it. Returns status created while PayPal is still activating; call again shortly.",
        auth: PUBLIC,
      },
    ],
  },
  {
    title: "Subscriptions",
    intro: "An account's paid PayPal subscription. Changes need the customer's approval on PayPal and apply once PayPal reports them.",
    endpoints: [
      { method: "GET", path: `${account}/subscription`, summary: "The subscription: offer, plan, price, renewal date and status. 404 when there is none.", auth: ACCOUNT_TOKEN },
      {
        method: "POST",
        path: `${account}/subscription/change`,
        summary: "Moves to another plan or interval. Body: { plan, interval?, return_url?, cancel_url? }. Returns PayPal's approval link.",
        auth: SECRET,
      },
      { method: "POST", path: `${account}/subscription/sync`, summary: "Re-reads the subscription from PayPal. Webhooks do this automatically.", auth: SECRET },
      { method: "POST", path: `${account}/subscription/cancel`, summary: "Cancels in PayPal and moves the account to the free plan. Body: { reason? }.", auth: SECRET },
      { method: "POST", path: `${account}/subscription/pause`, summary: "Suspends billing for 1 to 12 months. Body: { months, reason? }.", auth: SECRET },
      { method: "POST", path: `${account}/subscription/resume`, summary: "Ends a pause now: billing restarts and the plan comes back.", auth: SECRET },
    ],
  },
  {
    title: "Cancel flows",
    intro: "The steps, questions and save offers a customer sees when they cancel.",
    endpoints: [
      { method: "GET", path: `${app}/cancel-flows`, summary: "Every flow, with sessions and saves in the last 30 days.", auth: SECRET },
      { method: "GET", path: `${app}/cancel-flows/capabilities`, summary: "Whether dynamic offers (AI) and workflow pauses (Render) are configured on this API.", auth: SECRET },
      { method: "POST", path: `${app}/cancel-flows`, summary: "Creates a flow. Body: { id?, name?, status?, steps? }. Without steps, starts from a template.", auth: SECRET },
      { method: "GET", path: `${app}/cancel-flows/:flowId`, summary: "One flow.", auth: SECRET },
      { method: "PATCH", path: `${app}/cancel-flows/:flowId`, summary: "Updates name, status (active or draft) or steps. steps replaces the whole list.", auth: SECRET },
      { method: "DELETE", path: `${app}/cancel-flows/:flowId`, summary: "Deletes the flow.", auth: SECRET },
      { method: "GET", path: `${app}/cancel-flows/:flowId/stats`, summary: "Save rate, revenue kept, reasons and offer results. Query: days.", auth: SECRET },
      {
        method: "POST",
        path: `${app}/cancel-flows/:flowId/preview-offer`,
        summary: "The offer a customer would get for a set of answers, without starting a session.",
        auth: SECRET,
      },
    ],
  },
  {
    title: "Cancel sessions",
    intro: "One customer going through a flow. The SDK calls these with an account token; every call returns the session view.",
    endpoints: [
      { method: "POST", path: `${app}/cancel-sessions`, summary: "Starts a session. Body: { flow?, account? }. With a token, the account comes from the token.", auth: ACCOUNT_TOKEN },
      { method: "GET", path: `${app}/cancel-sessions`, summary: "Recent sessions with answers and offers. Query: flow, account, status, limit.", auth: SECRET },
      { method: "GET", path: `${app}/cancel-sessions/:sessionId`, summary: "One session.", auth: ACCOUNT_TOKEN },
      { method: "POST", path: `${app}/cancel-sessions/:sessionId/answer`, summary: "Answers the current step. Body: { step, answer?, text? }.", auth: ACCOUNT_TOKEN },
      { method: "POST", path: `${app}/cancel-sessions/:sessionId/back`, summary: "Goes back one step.", auth: ACCOUNT_TOKEN },
      { method: "POST", path: `${app}/cancel-sessions/:sessionId/decline`, summary: "Turns down the save offer.", auth: ACCOUNT_TOKEN },
      {
        method: "POST",
        path: `${app}/cancel-sessions/:sessionId/accept`,
        summary: "Applies the save offer. Discounts and downgrades return approve_url. Body: { return_url?, cancel_url? }.",
        auth: ACCOUNT_TOKEN,
      },
      { method: "POST", path: `${app}/cancel-sessions/:sessionId/cancel`, summary: "Cancels the subscription from the confirm step.", auth: ACCOUNT_TOKEN },
      { method: "POST", path: `${app}/cancel-sessions/:sessionId/close`, summary: "Marks an open session abandoned.", auth: ACCOUNT_TOKEN },
    ],
  },
  {
    title: "Analytics",
    intro: "Aggregates of recorded usage. interval is one of 7d, 30d, 60d, 6m, year or alltime.",
    endpoints: [
      { method: "GET", path: `${app}/analytics`, summary: "Calls and total amount per entitlement. Query: interval (required), namespace.", auth: SECRET },
      { method: "GET", path: `${app}/analytics/top-namespaces`, summary: "Most active accounts. Query: interval, limit, entitlement.", auth: SECRET },
      { method: "GET", path: `${app}/analytics/timeseries`, summary: "Daily buckets up to 60 days, weekly beyond. Query: interval, namespace, entitlement.", auth: SECRET },
      { method: "GET", path: `${app}/analytics/events`, summary: "Recent usage events, newest first. Query: namespace, entitlement, limit.", auth: SECRET },
      { method: "GET", path: `${app}/analytics/reports`, summary: "Saved reports.", auth: SECRET },
      { method: "POST", path: `${app}/analytics/reports`, summary: "Saves a report. Body: { name, entitlements?, interval? }.", auth: SECRET },
      { method: "GET", path: `${app}/analytics/reports/:id`, summary: "One saved report.", auth: SECRET },
      { method: "PATCH", path: `${app}/analytics/reports/:id`, summary: "Updates a saved report.", auth: SECRET },
      { method: "DELETE", path: `${app}/analytics/reports/:id`, summary: "Deletes a saved report.", auth: SECRET },
    ],
  },
  {
    title: "Webhooks and events",
    intro: "Endpoints that receive signed events, their delivery logs, and the app's event log.",
    endpoints: [
      { method: "GET", path: `${app}/webhooks`, summary: "Every endpoint, with delivery stats for the last 7 days.", auth: SECRET },
      { method: "POST", path: `${app}/webhooks`, summary: "Adds an endpoint. Body: { url, events, description?, source?, enabled? }. Up to 25 per app.", auth: SECRET },
      { method: "GET", path: `${app}/webhooks/:webhookId`, summary: "One endpoint, with its secret.", auth: SECRET },
      { method: "PATCH", path: `${app}/webhooks/:webhookId`, summary: "Updates url, events, description or enabled. Re-enabling clears disabled_reason.", auth: SECRET },
      { method: "DELETE", path: `${app}/webhooks/:webhookId`, summary: "Deletes the endpoint and its deliveries.", auth: SECRET },
      { method: "POST", path: `${app}/webhooks/:webhookId/secret/regenerate`, summary: "Replaces the signing secret.", auth: SECRET },
      { method: "POST", path: `${app}/webhooks/:webhookId/test`, summary: "Sends a sample event once and returns the delivery. Body: { type? }.", auth: SECRET },
      { method: "GET", path: `${app}/webhooks/:webhookId/deliveries`, summary: "Delivery log, newest first. Query: status, limit.", auth: SECRET },
      { method: "POST", path: `${app}/webhooks/:webhookId/deliveries/:deliveryId/retry`, summary: "Sends a delivery again, once, and returns the result.", auth: SECRET },
      { method: "GET", path: `${app}/events`, summary: "Events from the last 30 days, newest first. Query: type, limit.", auth: SECRET },
    ],
  },
  {
    title: "PayPal",
    intro: "Each app connects its own PayPal REST app, sandbox or live.",
    endpoints: [
      { method: "GET", path: `${app}/paypal`, summary: "Whether PayPal is connected, the environment, client id and webhook registration.", auth: SECRET },
      {
        method: "PUT",
        path: `${app}/paypal`,
        summary: "Connects PayPal. Body: { client_id, client_secret, env: sandbox | live }. Checks the credentials and registers the webhook when the API is public.",
        auth: SECRET,
      },
      { method: "DELETE", path: `${app}/paypal`, summary: "Disconnects PayPal. Existing subscriptions keep billing.", auth: SECRET },
      { method: "POST", path: "/paypal/webhooks/:appId", summary: "PayPal's notifications for the app, mapped onto checkouts and accounts.", auth: "No key. Verified with PayPal" },
    ],
  },
  {
    title: "MCP server",
    intro: "Each app's MCP server, and the OAuth 2.1 routes MCP clients use to connect without a key. The MCP server docs page covers the protocol and the tools.",
    endpoints: MCP_ENDPOINTS,
  },
  {
    title: "Admin only",
    intro: "Routes the dashboard and the Render Workflow call with the admin key. App keys get 401.",
    endpoints: [
      { method: "GET", path: "/orgs", summary: "Every dashboard workspace.", auth: ADMIN },
      { method: "POST", path: "/orgs", summary: "Creates a workspace. Body: { id, app_ids? }.", auth: ADMIN },
      { method: "GET", path: "/orgs/:orgId", summary: "One workspace.", auth: ADMIN },
      { method: "PATCH", path: "/orgs/:orgId", summary: "Updates app_ids, the apps the workspace shows.", auth: ADMIN },
      { method: "DELETE", path: "/orgs/:orgId", summary: "Deletes the workspace record. Its apps stay.", auth: ADMIN },
      { method: "GET", path: "/orgs/:orgId/apps", summary: "The workspace's apps, in app_ids order.", auth: ADMIN },
      { method: "GET", path: "/pauses/due", summary: "Pauses due to resume. Query: limit.", auth: ADMIN },
      { method: "POST", path: "/pauses/apply", summary: "Applies a pause. Body: { app_id, account_id, months, session_id?, reason? }.", auth: ADMIN },
      { method: "POST", path: "/pauses/resume", summary: "Resumes a paused subscription. Body: { app_id, account_id }.", auth: ADMIN },
      {
        method: "POST",
        path: `${app}/import`,
        summary: "Imports history: backdated accounts and usage events, up to 10,000 of each. No webhooks fire.",
        auth: ADMIN,
      },
      { method: "GET", path: `${app}/agent/threads`, summary: "The dashboard agent's chat threads for a user. Query: user_id, limit.", auth: ADMIN },
      { method: "GET", path: `${app}/agent/threads/:threadId`, summary: "One thread, with messages.", auth: ADMIN },
      { method: "PUT", path: `${app}/agent/threads/:threadId`, summary: "Creates a thread or replaces its messages. Body: { user_id, messages, title? }.", auth: ADMIN },
      { method: "PATCH", path: `${app}/agent/threads/:threadId`, summary: "Renames a thread. Body: { title }.", auth: ADMIN },
      { method: "DELETE", path: `${app}/agent/threads/:threadId`, summary: "Deletes a thread.", auth: ADMIN },
      ...MCP_ADMIN_ENDPOINTS,
      { method: "GET", path: "/api/auth/*", summary: "Dashboard sign-in (better-auth), proxied by the dashboard.", auth: ADMIN },
      { method: "POST", path: "/api/auth/*", summary: "Dashboard sign-in (better-auth), proxied by the dashboard.", auth: ADMIN },
    ],
  },
];
