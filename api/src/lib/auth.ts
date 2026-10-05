import type { Context, Next } from "hono";
import sql from "../db/client.ts";

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

// Guards /apps/:appId/*: admin key, the app's secret key, or (for a few
// read/usage routes) the app's public key.
export async function appAuth(c: Context, next: Next) {
  const key = bearer(c);
  if (!key) return unauthorized(c);
  if (isAdminKey(key)) return next();

  const appId = c.req.param("appId");
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
