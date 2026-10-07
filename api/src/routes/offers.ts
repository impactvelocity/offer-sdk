import { type Context, Hono } from "hono";
import sql from "../db/client.ts";
import { deleteDoc, getDoc, insertDoc, listDocs } from "../db/docs.ts";
import { billingPlanName, startCheckout } from "../lib/checkout.ts";
import { checkoutJson } from "../lib/grants.ts";
import { type Json, readObject, readOptionalJson } from "../lib/http.ts";
import { prefixedId } from "../lib/ids.ts";
import { buildNamespacePlan } from "../lib/namespace-plan.ts";
import {
  type Catalog,
  DEFAULT_OFFER_ID,
  defaultOffer,
  entryPrice,
  loadCatalog,
  offerIntervals,
  publicOffer,
  resolveOffer,
  unavailableReason,
  validateOffer,
} from "../lib/offers.ts";
import { ensureBillingPlan, PaypalError, requireConnection, type PaypalConnection } from "../lib/paypal.ts";
import { slugify } from "../lib/slugify.ts";

const offers = new Hono();

const notFound = { error: "Offer not found" };

const EDITABLE = [
  "name",
  "copy",
  "currency",
  "discount",
  "intervals",
  "plans",
  "default_plan",
  "bumps",
  "grant",
  "expires_at",
  "max_redemptions",
];

const SOURCES = ["manual", "agent_chat", "decide", "usage_limit", "campaign"];

const isHttpUrl = (v: unknown) => {
  if (typeof v !== "string") return false;
  try {
    return ["http:", "https:"].includes(new URL(v).protocol);
  } catch {
    return false;
  }
};

// Offer as the dashboard sees it, with live status and redemptions.
async function offerJson(appId: string, offer: Json) {
  const [{ count }] = await sql`
    select count(*)::int as count from checkouts
    where app_id = ${appId} and offer_id = ${offer.id} and status = 'completed'`;
  const reason = await unavailableReason(appId, offer, offer.account_id);
  return {
    ...offer,
    redemptions: count,
    availability: offer.status === "active" ? (reason ?? "available") : offer.status,
  };
}

// ─── Admin: CRUD ───────────────────────────────────────

// GET /apps/:appId/offers
offers.get("/", async (c) => {
  const appId = c.req.param("appId")!;
  const docs = await listDocs("offers", appId);
  const counts = new Map<string, number>(
    (
      await sql`
        select offer_id, count(*)::int as count from checkouts
        where app_id = ${appId} and status = 'completed' and offer_id is not null
        group by offer_id`
    ).map((r: { offer_id: string; count: number }) => [r.offer_id, r.count]),
  );
  return c.json(docs.map((o) => ({ ...o, redemptions: counts.get(o.id) ?? 0 })));
});

// POST /apps/:appId/offers/draft-preview
// Validates unsaved offer fields and returns the public view the checkout page
// would show, for the dashboard's live preview. Nothing is stored.
offers.post("/draft-preview", async (c) => {
  const appId = c.req.param("appId")!;
  const body = await readObject(c);
  const catalog = await loadCatalog(appId);
  const fields = await validateOffer(body, catalog);
  const id = typeof body.id === "string" && body.id ? slugify(body.id) : "draft";
  const draft: Json = { id, type: "shareable", ...fields, name: fields.name ?? id };
  const [paypal] = await sql`select client_id, env from paypal_connections where app_id = ${appId}`;
  return c.json({
    ...publicOffer(draft, catalog, { resolved_from: "requested", requested: null }),
    paypal: paypal ? { client_id: paypal.client_id, env: paypal.env } : null,
  });
});

// GET /apps/:appId/offers/:offerId
offers.get("/:offerId", async (c) => {
  const appId = c.req.param("appId")!;
  const offer = await getDoc("offers", appId, c.req.param("offerId"));
  if (!offer) return c.json(notFound, 404);
  return c.json(await offerJson(appId, offer));
});

// POST /apps/:appId/offers
// A shareable offer needs an `id` (used as its slug in links). A targeted
// offer (`type: "targeted"`, `account_id`) gets an unguessable id.
offers.post("/", async (c) => {
  const appId = c.req.param("appId")!;
  const body = await readObject(c);
  const type = body.type ?? "shareable";
  if (type !== "shareable" && type !== "targeted") return c.json({ error: 'type must be "shareable" or "targeted"' }, 400);

  let id: string;
  if (type === "targeted") {
    if (typeof body.account_id !== "string" || !(await getDoc("namespaces", appId, body.account_id))) {
      return c.json({ error: "A targeted offer needs an existing account_id" }, 400);
    }
    id = prefixedId("off", 16);
  } else {
    if (typeof body.id !== "string" || !body.id) return c.json({ error: "id is required" }, 400);
    id = slugify(body.id);
    if (!id || id === DEFAULT_OFFER_ID) return c.json({ error: `"${body.id}" can't be used as an offer id` }, 400);
  }

  const source = body.source ?? "manual";
  if (!SOURCES.includes(source)) return c.json({ error: `source must be one of ${SOURCES.join(", ")}` }, 400);

  const fields = await validateOffer(body, await loadCatalog(appId));
  const offer = {
    id,
    app_id: appId,
    type,
    ...(type === "targeted" ? { account_id: body.account_id } : {}),
    status: "draft",
    source,
    ...fields,
    name: fields.name ?? body.id ?? id,
    published_at: null,
    created_at: new Date().toISOString(),
  };

  if (!(await insertDoc("offers", appId, id, offer))) {
    return c.json({ error: `Offer with id "${id}" already exists` }, 409);
  }
  return c.json(offer, 201);
});

// PATCH /apps/:appId/offers/:offerId
// Edits apply to future purchases only: every checkout keeps the price it was quoted.
offers.patch("/:offerId", async (c) => {
  const appId = c.req.param("appId")!;
  const offerId = c.req.param("offerId");
  const current = await getDoc("offers", appId, offerId);
  if (!current) return c.json(notFound, 404);

  const patch = await readObject(c);
  const merged = { ...current, ...Object.fromEntries(Object.entries(patch).filter(([k]) => EDITABLE.includes(k))) };
  const fields = await validateOffer(merged, await loadCatalog(appId));

  const [row] = await sql`
    update offers set data = ${{ ...current, ...fields, name: fields.name ?? current.name }}::jsonb
    where app_id = ${appId} and id = ${offerId} returning data`;
  return c.json(row.data);
});

// DELETE /apps/:appId/offers/:offerId
// Accounts that bought through it keep their price and extras.
offers.delete("/:offerId", async (c) => {
  const deleted = await deleteDoc("offers", c.req.param("appId")!, c.req.param("offerId"));
  if (!deleted) return c.json(notFound, 404);
  return c.json({ deleted: true });
});

// ─── Admin: lifecycle ──────────────────────────────────

const recurring = (interval: string): interval is "month" | "year" => interval === "month" || interval === "year";

// Creates (or reuses) the PayPal billing plan behind every recurring price, so
// the first buyer doesn't wait for it.
async function prepareBillingPlans(conn: PaypalConnection, offer: Json, catalog: Catalog) {
  for (const entry of offer.plans as Json[]) {
    const plan = catalog.plans.get(entry.plan_id);
    if (!plan) continue;
    for (const interval of offerIntervals(offer).filter(recurring)) {
      const p = entryPrice(offer, entry, plan, interval);
      if (!p || p.amount <= 0) continue;
      await ensureBillingPlan(conn, {
        name: billingPlanName(offer, plan.pricingCard?.title ?? plan.name ?? plan.id, interval),
        interval,
        currency: offer.currency,
        price: p.amount,
        cycles: p.cycles,
        listPrice: p.list_price,
      });
    }
  }
}

// POST /apps/:appId/offers/:offerId/publish
offers.post("/:offerId/publish", async (c) => {
  const appId = c.req.param("appId")!;
  const offerId = c.req.param("offerId");
  const offer = await getDoc("offers", appId, offerId);
  if (!offer) return c.json(notFound, 404);

  const catalog = await loadCatalog(appId);
  const fields = await validateOffer(offer, catalog); // the catalog may have changed since it was saved
  const next = { ...offer, ...fields, name: fields.name ?? offer.name };

  try {
    await prepareBillingPlans(await requireConnection(appId), next, catalog);
  } catch (err) {
    if (err instanceof PaypalError) return c.json({ error: `PayPal: ${err.message}` }, 502);
    throw err;
  }

  const [row] = await sql`
    update offers set data = ${{ ...next, status: "active", published_at: offer.published_at ?? new Date().toISOString() }}::jsonb
    where app_id = ${appId} and id = ${offerId} returning data`;
  return c.json(await offerJson(appId, row.data));
});

// POST /apps/:appId/offers/:offerId/archive
// Stops new purchases; existing buyers keep their terms.
offers.post("/:offerId/archive", async (c) => {
  const appId = c.req.param("appId")!;
  const [row] = await sql`
    update offers set data = data || '{"status":"archived"}'::jsonb
    where app_id = ${appId} and id = ${c.req.param("offerId")} returning data`;
  if (!row) return c.json(notFound, 404);
  return c.json(await offerJson(appId, row.data));
});

// POST /apps/:appId/offers/:offerId/preview
// Body: { account? }. What each plan in the offer gives: the plan's
// entitlements with the offer's extras on top. With an account, also what
// would change compared with its current access.
offers.post("/:offerId/preview", async (c) => {
  const appId = c.req.param("appId")!;
  const offerId = c.req.param("offerId");
  const catalog = await loadCatalog(appId);
  const offer = offerId === DEFAULT_OFFER_ID ? defaultOffer(appId, catalog) : await getDoc("offers", appId, offerId);
  if (!offer) return c.json(notFound, 404);

  const { account } = await readOptionalJson(c);
  const current = typeof account === "string" ? await buildNamespacePlan(appId, account) : null;
  if (typeof account === "string" && (current === null || current === "plan_not_found")) {
    return c.json({ error: "Account not found" }, 404);
  }
  const currentMax = new Map(
    current && current !== "plan_not_found" ? current.entitlements.map((e) => [e.id, e.max]) : [],
  );

  const view = publicOffer(offer, catalog);
  const plans = (offer.plans as Json[]).map((entry) => {
    const plan = catalog.plans.get(entry.plan_id)!;
    const merged = new Map<string, Json>();
    for (const e of plan.entitlements ?? []) merged.set(e.id, { ...e, source: "plan" });
    for (const e of entry.entitlements ?? []) merged.set(e.id, { ...e, source: "offer" });
    const entitlements = [...merged.values()].map((e) => ({
      id: e.id,
      name: catalog.entitlements.get(e.id)?.name ?? e.id,
      max: e.max ?? null,
      source: e.source,
    }));
    return {
      plan_id: entry.plan_id,
      prices: view.plans.find((p) => p.id === entry.plan_id)?.prices ?? {},
      entitlements,
      addons: [...new Set([...(plan.addons ?? []), ...(offer.grant?.addons ?? []), ...(entry.addons ?? [])])],
      ...(current && current !== "plan_not_found"
        ? {
            changes: entitlements
              .filter((e) => !currentMax.has(e.id) || currentMax.get(e.id) !== e.max)
              .map((e) => ({ id: e.id, name: e.name, from: currentMax.has(e.id) ? currentMax.get(e.id) : "none", to: e.max })),
          }
        : {}),
    };
  });
  return c.json({ offer_id: offer.id, currency: offer.currency, plans, bumps: view.bumps });
});

// GET /apps/:appId/offers/:offerId/stats
offers.get("/:offerId/stats", async (c) => {
  const appId = c.req.param("appId")!;
  const offerId = c.req.param("offerId");
  if (!(await getDoc("offers", appId, offerId))) return c.json(notFound, 404);

  const [[events], byPlan, byRef, bumps] = await Promise.all([
    sql`
      select count(*) filter (where type = 'viewed')::int as views
      from offer_events where app_id = ${appId} and offer_id = ${offerId}`,
    sql`
      select plan_id, interval,
             count(*)::int as checkouts,
             count(*) filter (where status = 'completed')::int as completed,
             coalesce(sum((quote ->> 'total_today')::numeric) filter (where status = 'completed'), 0)::float8 as revenue
      from checkouts where app_id = ${appId} and offer_id = ${offerId}
      group by plan_id, interval order by completed desc, plan_id`,
    sql`
      select coalesce(ref, '') as ref,
             count(*)::int as checkouts,
             count(*) filter (where status = 'completed')::int as completed,
             coalesce(sum((quote ->> 'total_today')::numeric) filter (where status = 'completed'), 0)::float8 as revenue
      from checkouts where app_id = ${appId} and offer_id = ${offerId}
      group by ref order by completed desc`,
    sql`
      select bump, count(*)::int as taken
      from checkouts, jsonb_array_elements_text(bump_ids) as bump
      where app_id = ${appId} and offer_id = ${offerId} and status = 'completed'
      group by bump`,
  ]);

  const checkouts = byPlan.reduce((n: number, r: Json) => n + r.checkouts, 0);
  const completed = byPlan.reduce((n: number, r: Json) => n + r.completed, 0);
  const revenue = byPlan.reduce((n: number, r: Json) => n + r.revenue, 0);
  return c.json({
    offer_id: offerId,
    views: events.views,
    checkouts,
    completed,
    conversion: events.views ? completed / events.views : null,
    revenue: Math.round(revenue * 100) / 100,
    by_plan: byPlan,
    by_ref: byRef.map((r: Json) => ({ ...r, ref: r.ref || null })),
    bumps: bumps.map((b: Json) => ({ id: b.bump, taken: b.taken, rate: completed ? b.taken / completed : 0 })),
  });
});

// ─── Public (publishable key) ──────────────────────────

// GET /apps/:appId/offers/:offerId/public?fallback=&account=&ref=
// The offer the checkout page should show: the requested one if it can be
// bought, else the fallback, else regular prices. Never a 404. Includes the
// app's PayPal client id for loading PayPal's buttons.
offers.get("/:offerId/public", async (c) => {
  const appId = c.req.param("appId")!;
  const catalog = await loadCatalog(appId);
  const { offer, ...resolution } = await resolveOffer(appId, catalog, c.req.param("offerId"), {
    fallback: c.req.query("fallback"),
    account: c.req.query("account"),
  });

  if (offer.id !== DEFAULT_OFFER_ID) {
    await sql`
      insert into offer_events (app_id, offer_id, type, ref)
      values (${appId}, ${offer.id}, 'viewed', ${c.req.query("ref") ?? null})`;
  }
  // The PayPal client id is public: the page needs it to load PayPal's buttons.
  const [paypal] = await sql`select client_id, env from paypal_connections where app_id = ${appId}`;
  return c.json({ ...publicOffer(offer, catalog, resolution), paypal: paypal ? { client_id: paypal.client_id, env: paypal.env } : null });
});

// POST /apps/:appId/offers/:offerId/checkout
// Body: { plan, interval, bumps?, account? | email?, ref?, return_url?, cancel_url? }.
// Prices the selection from the stored offer and creates the PayPal
// subscription (month, year) or order (once). The SDK hands `paypal.id` to the
// PayPal button; `approve_url` is for redirect flows such as emailed links.
offers.post("/:offerId/checkout", async (c) => {
  const body = await readObject(c);
  return createCheckout(c, c.req.param("offerId"), body);
});

// Validates a checkout request and starts it. Shared with the plan shortcut
// (POST /plans/:planId/checkout), which sells through the default offer.
export async function createCheckout(c: Context, offerId: string, body: Json) {
  const appId = c.req.param("appId")!;
  const { account, email, ref, return_url, cancel_url } = body;

  if (account !== undefined && typeof account !== "string") return c.json({ error: "account must be a string" }, 400);
  if (email !== undefined && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return c.json({ error: "email must be an email address" }, 400);
  }
  if (!account && !email) return c.json({ error: "account or email is required" }, 400);
  if (ref !== undefined && (typeof ref !== "string" || ref.length > 100)) return c.json({ error: "ref must be a short string" }, 400);
  for (const [field, value] of Object.entries({ return_url, cancel_url })) {
    if (value !== undefined && !isHttpUrl(value)) return c.json({ error: `${field} must be an http(s) URL` }, 400);
  }
  if (account && !(await getDoc("namespaces", appId, account))) return c.json({ error: "Account not found" }, 404);

  const catalog = await loadCatalog(appId);
  const offer = offerId === DEFAULT_OFFER_ID ? defaultOffer(appId, catalog) : await getDoc("offers", appId, offerId);
  if (!offer) return c.json(notFound, 404);
  const reason = offerId === DEFAULT_OFFER_ID ? null : await unavailableReason(appId, offer, account);
  if (reason) return c.json({ error: `This offer can't be bought (${reason.replace("_", " ")})`, reason }, 409);

  const row = await startCheckout(
    appId,
    offer,
    catalog,
    { plan: body.plan, interval: body.interval, bumps: body.bumps },
    { account, email, ref, returnUrl: return_url, cancelUrl: cancel_url },
  );
  return c.json(checkoutJson(row), 201);
}

export default offers;
