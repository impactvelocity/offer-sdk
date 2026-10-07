import sql from "../db/client.ts";
import { ApiError, type Json } from "./http.ts";
import { decryptSecret } from "./secrets.ts";

// Thin PayPal REST client, one connection per app (each app brings its own
// PayPal REST credentials). Covers what offers need: OAuth, catalog products,
// billing plans, subscriptions, orders and webhooks.

export type PaypalEnv = "sandbox" | "live";

export type PaypalConnection = {
  app_id: string;
  env: PaypalEnv;
  client_id: string;
  client_secret: string; // decrypted
  webhook_id: string | null;
  product_id: string | null;
};

const BASE_URLS: Record<PaypalEnv, string> = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

// PAYPAL_API_URL points every app at one base URL (tests use a fake PayPal).
const baseUrl = (env: PaypalEnv) => process.env.PAYPAL_API_URL || BASE_URLS[env];

export class PaypalError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

// ─── Connections ───────────────────────────────────────

export async function getConnection(appId: string): Promise<PaypalConnection | null> {
  const [row] = await sql`
    select app_id, env, client_id, client_secret, webhook_id, product_id
    from paypal_connections where app_id = ${appId}`;
  if (!row) return null;
  return { ...row, client_secret: decryptSecret(row.client_secret) };
}

export async function requireConnection(appId: string): Promise<PaypalConnection> {
  const conn = await getConnection(appId);
  if (!conn) throw new ApiError(409, "PayPal is not connected for this app");
  return conn;
}

// ─── HTTP ──────────────────────────────────────────────

const tokens = new Map<string, { token: string; expires: number; clientId: string }>();

export function forgetToken(appId: string) {
  tokens.delete(appId);
}

type Credentials = Pick<PaypalConnection, "app_id" | "env" | "client_id" | "client_secret">;

async function accessToken(conn: Credentials): Promise<string> {
  const cached = tokens.get(conn.app_id);
  if (cached && cached.clientId === conn.client_id && cached.expires > Date.now()) return cached.token;

  const res = await fetch(`${baseUrl(conn.env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${conn.client_id}:${conn.client_secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new PaypalError(res.status, body.error_description ?? "PayPal rejected the credentials", body);
  }
  // Refresh a minute early.
  tokens.set(conn.app_id, {
    token: body.access_token,
    expires: Date.now() + (Number(body.expires_in ?? 300) - 60) * 1000,
    clientId: conn.client_id,
  });
  return body.access_token;
}

async function request<T = any>(
  conn: Credentials,
  method: string,
  path: string,
  body?: unknown,
  opts: { requestId?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken(conn)}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  // PayPal-Request-Id makes create calls idempotent on PayPal's side.
  if (opts.requestId) headers["PayPal-Request-Id"] = opts.requestId;

  const res = await fetch(`${baseUrl(conn.env)}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // Non-JSON error pages fall through to the status check.
  }
  if (!res.ok) {
    const detail = json.details?.[0]?.description ?? json.message ?? `PayPal request failed (${res.status})`;
    throw new PaypalError(res.status, detail, json);
  }
  return json as T;
}

// Checks credentials by fetching a token.
export async function verifyCredentials(conn: Credentials) {
  await accessToken(conn);
}

const link = (body: Json, rel: string): string | null =>
  (body.links as { rel: string; href: string }[] | undefined)?.find((l) => l.rel === rel)?.href ?? null;

// ─── Catalog and plans ─────────────────────────────────

export async function createProduct(conn: Credentials, name: string): Promise<string> {
  const product = await request(conn, "POST", "/v1/catalogs/products", {
    name: name.slice(0, 127),
    type: "SERVICE",
    category: "SOFTWARE",
  });
  return product.id;
}

const UNIT = { month: "MONTH", year: "YEAR" } as const;

const money = (value: number, currency: string) => ({ value: value.toFixed(2), currency_code: currency });

// A billing plan: `cycles` intervals at the sale price as a TRIAL, then the
// regular price until cancelled. Without cycles the sale price is the regular price.
export async function createBillingPlan(
  conn: Credentials,
  p: {
    productId: string;
    name: string;
    interval: "month" | "year";
    currency: string;
    price: number;
    cycles: number | null;
    regularPrice: number;
  },
): Promise<string> {
  const frequency = { interval_unit: UNIT[p.interval], interval_count: 1 };
  const billing_cycles = p.cycles
    ? [
        {
          frequency,
          tenure_type: "TRIAL",
          sequence: 1,
          total_cycles: p.cycles,
          pricing_scheme: { fixed_price: money(p.price, p.currency) },
        },
        {
          frequency,
          tenure_type: "REGULAR",
          sequence: 2,
          total_cycles: 0,
          pricing_scheme: { fixed_price: money(p.regularPrice, p.currency) },
        },
      ]
    : [
        {
          frequency,
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: { fixed_price: money(p.price, p.currency) },
        },
      ];

  const plan = await request(conn, "POST", "/v1/billing/plans", {
    product_id: p.productId,
    name: p.name.slice(0, 127),
    status: "ACTIVE",
    billing_cycles,
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee_failure_action: "CANCEL",
      payment_failure_threshold: 3,
    },
  });
  return plan.id;
}

// The app's PayPal catalog product, created on first use.
async function productId(conn: PaypalConnection): Promise<string> {
  if (conn.product_id) return conn.product_id;
  const [app] = await sql`select data ->> 'name' as name from apps where id = ${conn.app_id}`;
  const id = await createProduct(conn, app?.name || conn.app_id);
  await sql`update paypal_connections set product_id = ${id}, updated_at = now() where app_id = ${conn.app_id}`;
  conn.product_id = id;
  return id;
}

// The PayPal billing plan for a price shape, created once and reused by every
// offer and checkout with the same interval, currency, prices and intro cycles.
export async function ensureBillingPlan(
  conn: PaypalConnection,
  p: {
    name: string;
    interval: "month" | "year";
    currency: string;
    price: number;
    cycles: number | null;
    listPrice: number | null;
  },
): Promise<string> {
  const regularPrice = p.cycles ? (p.listPrice ?? p.price) : p.price;
  const key = [p.interval, p.currency, p.price.toFixed(2), p.cycles ?? 0, regularPrice.toFixed(2)].join(":");
  const [existing] = await sql`
    select paypal_plan_id from paypal_plans where app_id = ${conn.app_id} and key = ${key}`;
  if (existing) return existing.paypal_plan_id;

  const planId = await createBillingPlan(conn, {
    productId: await productId(conn),
    name: p.name,
    interval: p.interval,
    currency: p.currency,
    price: p.price,
    cycles: p.cycles,
    regularPrice,
  });
  // A concurrent checkout may have created the same shape; keep the first.
  const [row] = await sql`
    insert into paypal_plans (app_id, key, paypal_plan_id) values (${conn.app_id}, ${key}, ${planId})
    on conflict (app_id, key) do update set key = excluded.key
    returning paypal_plan_id`;
  return row.paypal_plan_id;
}

// ─── Subscriptions ─────────────────────────────────────

type Context = { brandName?: string; returnUrl?: string; cancelUrl?: string };

const applicationContext = (ctx: Context, userAction: string) => ({
  ...(ctx.brandName ? { brand_name: ctx.brandName.slice(0, 127) } : {}),
  shipping_preference: "NO_SHIPPING",
  user_action: userAction,
  ...(ctx.returnUrl ? { return_url: ctx.returnUrl } : {}),
  ...(ctx.cancelUrl ? { cancel_url: ctx.cancelUrl } : {}),
});

// One-time bumps ride along as the subscription's setup fee, charged at activation.
export async function createSubscription(
  conn: Credentials,
  p: { planId: string; customId: string; setupFee: number; currency: string; email?: string | null } & Context,
): Promise<{ id: string; approveUrl: string | null }> {
  const sub = await request(
    conn,
    "POST",
    "/v1/billing/subscriptions",
    {
      plan_id: p.planId,
      custom_id: p.customId,
      ...(p.setupFee > 0 ? { plan: { payment_preferences: { setup_fee: money(p.setupFee, p.currency) } } } : {}),
      ...(p.email ? { subscriber: { email_address: p.email } } : {}),
      application_context: applicationContext(p, "SUBSCRIBE_NOW"),
    },
    { requestId: `sub-${p.customId}` },
  );
  return { id: sub.id, approveUrl: link(sub, "approve") };
}

export async function getSubscription(conn: Credentials, id: string) {
  return request(conn, "GET", `/v1/billing/subscriptions/${encodeURIComponent(id)}`);
}

// Moves a subscription to another billing plan. PayPal answers with an
// approval link when the buyer has to agree to the new price.
export async function reviseSubscription(conn: Credentials, id: string, planId: string, ctx: Context = {}) {
  const res = await request(conn, "POST", `/v1/billing/subscriptions/${encodeURIComponent(id)}/revise`, {
    plan_id: planId,
    application_context: applicationContext(ctx, "CONTINUE"),
  });
  return { approveUrl: link(res, "approve") };
}

export async function cancelSubscription(conn: Credentials, id: string, reason: string) {
  await request(conn, "POST", `/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, { reason });
}

// Stops billing without cancelling; `activateSubscription` resumes it.
export async function suspendSubscription(conn: Credentials, id: string, reason: string) {
  await request(conn, "POST", `/v1/billing/subscriptions/${encodeURIComponent(id)}/suspend`, { reason });
}

export async function activateSubscription(conn: Credentials, id: string, reason: string) {
  await request(conn, "POST", `/v1/billing/subscriptions/${encodeURIComponent(id)}/activate`, { reason });
}

// ─── Orders (one-time prices) ──────────────────────────

export async function createOrder(
  conn: Credentials,
  p: { customId: string; currency: string; items: { name: string; amount: number }[] } & Context,
): Promise<{ id: string; approveUrl: string | null }> {
  const total = p.items.reduce((sum, i) => sum + i.amount, 0);
  const order = await request(
    conn,
    "POST",
    "/v2/checkout/orders",
    {
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: p.customId,
          amount: { ...money(total, p.currency), breakdown: { item_total: money(total, p.currency) } },
          items: p.items.map((i) => ({
            name: i.name.slice(0, 127),
            quantity: "1",
            category: "DIGITAL_GOODS",
            unit_amount: money(i.amount, p.currency),
          })),
        },
      ],
      application_context: applicationContext(p, "PAY_NOW"),
    },
    { requestId: `ord-${p.customId}` },
  );
  return { id: order.id, approveUrl: link(order, "approve") ?? link(order, "payer-action") };
}

export async function getOrder(conn: Credentials, id: string) {
  return request(conn, "GET", `/v2/checkout/orders/${encodeURIComponent(id)}`);
}

export async function captureOrder(conn: Credentials, id: string) {
  return request(conn, "POST", `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {}, { requestId: `cap-${id}` });
}

// ─── Webhooks ──────────────────────────────────────────

export const PAYPAL_WEBHOOK_EVENTS = [
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.CAPTURE.COMPLETED",
];

export async function createWebhook(conn: Credentials, url: string): Promise<string> {
  const hook = await request(conn, "POST", "/v1/notifications/webhooks", {
    url,
    event_types: PAYPAL_WEBHOOK_EVENTS.map((name) => ({ name })),
  });
  return hook.id;
}

// Asks PayPal whether a webhook delivery is genuine.
export async function verifyWebhook(conn: PaypalConnection, headers: Headers, event: unknown): Promise<boolean> {
  if (!conn.webhook_id) return false;
  const res = await request(conn, "POST", "/v1/notifications/verify-webhook-signature", {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: conn.webhook_id,
    webhook_event: event,
  });
  return res.verification_status === "SUCCESS";
}
