import type { Context, Next } from "hono";
import sql from "../db/client.ts";
import { ACCOUNT_TOKEN_PREFIX, verifyAccountToken } from "./account-tokens.ts";

const unauthorized = (c: Context) => c.json({ error: "Unauthorized" }, 401);

function bearer(c: Context) {
  const auth = c.req.header("Authorization");
  return auth?.startsWith("Bearer ") ? auth.slice(7) : null;
}

const isAdminKey = (key: string) => !!process.env.ADMIN_API_KEY && key === process.env.ADMIN_API_KEY;

// Checkout routes the SDK calls from the browser.
const PUBLIC_CHECKOUT_ROUTES: [string, RegExp][] = [
  ["GET", /^\/apps\/[^/]+\/offers\/[^/]+\/public$/],
  ["POST", /^\/apps\/[^/]+\/offers\/[^/]+\/checkout$/],
  ["POST", /^\/apps\/[^/]+\/plans\/[^/]+\/checkout$/],
  ["GET", /^\/apps\/[^/]+\/checkouts\/[^/]+$/],
  ["POST", /^\/apps\/[^/]+\/checkouts\/[^/]+\/complete$/],
];

// Public keys may only read plan state / pricing, track usage and run checkouts.
function publicKeyAllowed(c: Context) {
  const path = c.req.path;
  const isGet = c.req.method === "GET";
  const isNamespacePlan = isGet && (path.endsWith("/plan") || path.endsWith("/full-plan"));
  const isUsage = path.includes("/usage");
  const isPricing = isGet && path.includes("/pricing");
  const isCheckout = PUBLIC_CHECKOUT_ROUTES.some(([method, re]) => c.req.method === method && re.test(path));
  return isNamespacePlan || isUsage || isPricing || isCheckout;
}

declare module "hono" {
  interface ContextVariableMap {
    /** Set when the caller used an account token: the only account it may act for. */
    accountId: string;
  }
}

// Routes an account token may call. Each handler also checks that the account
// it touches is the token's (see cancel-sessions.ts and namespaces.ts).
function accountTokenAllowed(c: Context, accountId: string) {
  const path = c.req.path;
  if (/^\/apps\/[^/]+\/cancel-sessions(\/[^/]+(\/[a-z-]+)?)?$/.test(path)) return true;
  const own = path.match(/^\/apps\/[^/]+\/namespaces\/([^/]+)\/(plan|full-plan|subscription)$/);
  return c.req.method === "GET" && own !== null && decodeURIComponent(own[1]) === accountId;
}

// Guards /apps/:appId/*: admin key, the app's secret key, an account token
// (customer-facing flows for one account), or (for a few read/usage routes)
// the app's public key.
export async function appAuth(c: Context, next: Next) {
  const key = bearer(c);
  if (!key) return unauthorized(c);
  if (isAdminKey(key)) return next();

  const appId = c.req.param("appId");
  if (key.startsWith(ACCOUNT_TOKEN_PREFIX)) {
    const accountId = appId ? await verifyAccountToken(key, appId) : null;
    if (!accountId || !accountTokenAllowed(c, accountId)) return unauthorized(c);
    c.set("accountId", accountId);
    return next();
  }

  const [row] = await sql`
    select api_key = ${key} as secret
    from apps
    where id = ${appId} and (api_key = ${key} or public_key = ${key})`;

  if (row?.secret) return next();
  if (row && publicKeyAllowed(c)) return next();
  return unauthorized(c);
}

export async function adminAuth(c: Context, next: Next) {
  const key = bearer(c);
  if (!key || !isAdminKey(key)) return unauthorized(c);
  return next();
}
