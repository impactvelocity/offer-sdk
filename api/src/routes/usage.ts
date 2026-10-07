import { Hono } from "hono";
import type { Context } from "hono";
import sql from "../db/client.ts";
import { getDoc } from "../db/docs.ts";
import { syncOpenCheckouts } from "../lib/checkout.ts";
import { ApiError, type Json, readJson } from "../lib/http.ts";
import { effectiveLimit } from "../lib/namespace-plan.ts";
import { limitReachedBody } from "../lib/overage.ts";
import { USAGE_WARNING_THRESHOLD } from "../lib/webhook-events.ts";
import { emit, hasUsageSubscribers } from "../lib/webhooks.ts";

const usage = new Hono();

type Operation = "add" | "remove" | "amount";

async function resolveUsageContext(c: Context) {
  const appId = c.req.param("appId")!;
  const namespaceId = c.req.param("namespaceId")!;
  const entitlementId = c.req.param("entitlementId")!;

  const [namespace, entitlement] = await Promise.all([
    getDoc("namespaces", appId, namespaceId),
    getDoc("entitlements", appId, entitlementId),
  ]);
  if (!namespace) throw new ApiError(404, "Namespace not found");
  if (!entitlement) throw new ApiError(404, "Entitlement not found");
  if (entitlement.type !== "usage") throw new ApiError(400, "Entitlement is not a usage type");

  return { appId, namespaceId, entitlementId, namespace, entitlement };
}

type UsageContext = Awaited<ReturnType<typeof resolveUsageContext>>;

// Fires usage.limit_reached / usage.limit_warning when this change crossed the
// limit or 80% of it. Only runs when an endpoint listens for usage events.
async function emitUsageThresholds(ctx: UsageContext, amount: number, count: number) {
  try {
    if (!(await hasUsageSubscribers(ctx.appId))) return;

    // Effective limit: plan, then offer extras, then the incentive.
    const max = await effectiveLimit(ctx.appId, ctx.namespace, ctx.entitlementId);
    if (max === null || max === undefined || max <= 0) return; // unlimited, or no positive limit

    const prev = count - amount;
    const warnAt = max * USAGE_WARNING_THRESHOLD;
    const type =
      prev < max && max <= count
        ? "usage.limit_reached"
        : prev < warnAt && warnAt <= count
          ? "usage.limit_warning"
          : null;
    if (!type) return;

    await emit(ctx.appId, type, {
      object: {
        account_id: ctx.namespaceId,
        entitlement_id: ctx.entitlementId,
        entitlement_name: ctx.entitlement.name ?? ctx.entitlementId,
        usage: count,
        max,
        left: Math.max(0, max - count),
        percent: Math.round((count / max) * 100),
      },
    });
  } catch (err) {
    console.error("usage webhook check failed:", err);
  }
}

// Atomically bumps the counter and appends an analytics event in one statement.
// With a `limit`, the bump only happens if the new count stays within it;
// returns null when it would go over.
async function bump(ctx: UsageContext, operation: Operation, amount: number, limit: number | null | undefined) {
  const { appId, namespaceId, entitlementId } = ctx;
  const capped = typeof limit === "number";
  if (capped && amount > limit) return null;
  const [row] = await sql`
    with counter as (
      insert into usage_counters (app_id, namespace_id, entitlement_id, count)
      values (${appId}, ${namespaceId}, ${entitlementId}, ${amount})
      on conflict (app_id, namespace_id, entitlement_id)
      do update set count = usage_counters.count + excluded.count, updated_at = now()
      where not ${capped} or usage_counters.count + excluded.count <= ${capped ? limit : 0}
      returning count
    )
    insert into usage_events (app_id, namespace_id, entitlement_id, operation, amount, count)
    select ${appId}, ${namespaceId}, ${entitlementId}, ${operation}, ${amount}, count from counter
    returning count::float8 as count`;
  return (row?.count as number | undefined) ?? null;
}

// Entitlements with `overage: { mode: "block" }` refuse usage past the limit
// with a 402 that explains it and offers an upgrade (lib/overage.ts).
const blocks = (ctx: UsageContext, amount: number) => amount > 0 && ctx.entitlement.overage?.mode === "block";

async function increment(c: Context, ctx: UsageContext, operation: Operation, amount: number) {
  const { appId, namespaceId, entitlementId } = ctx;
  let limit = blocks(ctx, amount) ? await effectiveLimit(appId, ctx.namespace, entitlementId) : undefined;
  let count = await bump(ctx, operation, amount, limit);

  // Over the limit: a purchase may have just gone through (an emailed or
  // agent-shown link, before PayPal's webhook), so check and try once more.
  if (count === null && (await syncOpenCheckouts(appId, namespaceId))) {
    const namespace = (await getDoc("namespaces", appId, namespaceId)) ?? ctx.namespace;
    limit = await effectiveLimit(appId, namespace, entitlementId);
    count = await bump({ ...ctx, namespace }, operation, amount, limit);
  }

  if (count === null) {
    const [row] = await sql`
      select count::float8 as count from usage_counters
      where app_id = ${appId} and namespace_id = ${namespaceId} and entitlement_id = ${entitlementId}`;
    return c.json(await limitReachedBody(appId, ctx.namespace, ctx.entitlement, row?.count ?? 0, limit as number), 402);
  }

  await emitUsageThresholds(ctx, amount, count);
  return c.json({ entitlement: entitlementId, count });
}

// GET /apps/:appId/namespaces/:namespaceId/usage
// Map of the namespace's plan entitlement ids to their current counts.
usage.get("/", async (c) => {
  const appId = c.req.param("appId")!;
  const namespaceId = c.req.param("namespaceId")!;

  const namespace = await getDoc("namespaces", appId, namespaceId);
  if (!namespace) return c.json({ error: "Namespace not found" }, 404);

  const plan = await getDoc("plans", appId, namespace.plan);
  const ids: string[] = (plan?.entitlements ?? []).map((e: { id: string }) => e.id);
  if (!ids.length) return c.json({});

  const rows = await sql`
    select entitlement_id, count::float8 as count
    from usage_counters
    where app_id = ${appId} and namespace_id = ${namespaceId}
      and entitlement_id in (select jsonb_array_elements_text(${ids}::jsonb))`;
  const counts = new Map<string, number>(rows.map((r: { entitlement_id: string; count: number }) => [r.entitlement_id, r.count]));

  return c.json(Object.fromEntries(ids.map((id) => [id, counts.get(id) ?? 0])));
});

// GET /apps/:appId/namespaces/:namespaceId/usage/:entitlementId
usage.get("/:entitlementId", async (c) => {
  const { appId, namespaceId, entitlementId } = await resolveUsageContext(c);
  const [row] = await sql`
    select count::float8 as count from usage_counters
    where app_id = ${appId} and namespace_id = ${namespaceId} and entitlement_id = ${entitlementId}`;
  return c.json({ entitlement: entitlementId, count: row?.count ?? 0 });
});

// POST /apps/:appId/namespaces/:namespaceId/usage/:entitlementId/add
usage.post("/:entitlementId/add", async (c) => increment(c, await resolveUsageContext(c), "add", 1));

// POST /apps/:appId/namespaces/:namespaceId/usage/:entitlementId/remove
// Secret key only (lib/auth.ts).
usage.post("/:entitlementId/remove", async (c) => increment(c, await resolveUsageContext(c), "remove", -1));

// POST /apps/:appId/namespaces/:namespaceId/usage/:entitlementId/amount
// Body: { amount: number }. The public key can't send a negative amount.
usage.post("/:entitlementId/amount", async (c) => {
  const ctx = await resolveUsageContext(c);
  const { amount } = (await readJson(c)) ?? {};
  if (typeof amount !== "number" || !Number.isInteger(amount)) {
    return c.json({ error: "amount must be an integer" }, 400);
  }
  // A browser holding the public key mustn't be able to lower its own count.
  if (amount < 0 && c.get("publicKey")) {
    return c.json({ error: "The public key can only add usage. Subtract with the secret key." }, 403);
  }
  return increment(c, ctx, "amount", amount);
});

export default usage;
