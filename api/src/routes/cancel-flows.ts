import { Hono } from "hono";
import sql from "../db/client.ts";
import { changeDoc, deleteDoc, getDoc, insertDoc, listDocs } from "../db/docs.ts";
import {
  accountSnapshot,
  type AccountSnapshot,
  loadFlowCatalog,
  presentOffer,
  staticSpec,
  type Step,
  templateSteps,
  validateSteps,
} from "../lib/cancel-flows.ts";
import { decideEnabled, decideOffer } from "../lib/decide.ts";
import { type Json, omit, readObject, readOptionalJson } from "../lib/http.ts";
import { listPrice } from "../lib/offers.ts";
import { buildNamespacePlan } from "../lib/namespace-plan.ts";
import { workflowsEnabled } from "../lib/pauses.ts";
import { slugify } from "../lib/slugify.ts";

// /apps/:appId/cancel-flows — what the dashboard edits: the questions asked
// when a customer cancels, the save offer, and whether Claude decides it.
const cancelFlows = new Hono();

const notFound = { error: "Cancel flow not found" };
const STATUSES = ["active", "draft"];

// Whether dynamic offers and workflow pauses are wired up on this API, so the
// dashboard can say what's missing.
const capabilities = () => ({ dynamic_offers: decideEnabled(), pause_workflows: workflowsEnabled() });

// GET /apps/:appId/cancel-flows
cancelFlows.get("/", async (c) => {
  const appId = c.req.param("appId")!;
  const [flows, counts] = await Promise.all([
    listDocs("cancel_flows", appId),
    sql`
      select flow_id, count(*)::int as sessions, count(*) filter (where status = 'saved')::int as saved
      from cancel_sessions where app_id = ${appId} and created_at > now() - interval '30 days'
      group by flow_id`,
  ]);
  const byFlow = new Map(counts.map((r: { flow_id: string }) => [r.flow_id, r]));
  return c.json(
    flows.map((f) => ({ ...f, last_30_days: byFlow.get(f.id) ?? { sessions: 0, saved: 0 } })),
  );
});

// GET /apps/:appId/cancel-flows/capabilities
cancelFlows.get("/capabilities", (c) => c.json(capabilities()));

// POST /apps/:appId/cancel-flows
// Body: { id?, name?, status?, steps? }. Without steps, starts from a template
// (reason question → save offer → confirm).
cancelFlows.post("/", async (c) => {
  const appId = c.req.param("appId")!;
  const body = await readOptionalJson(c);
  const id = slugify(typeof body.id === "string" && body.id ? body.id : "default");
  const status = body.status ?? "draft";
  if (!STATUSES.includes(status)) return c.json({ error: "status must be active or draft" }, 400);
  const catalog = await loadFlowCatalog(appId);
  const now = new Date().toISOString();
  const flow = {
    id,
    app_id: appId,
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : "Cancel flow",
    status,
    steps: validateSteps(body.steps ?? templateSteps(), catalog),
    created_at: now,
    updated_at: now,
  };
  if (!(await insertDoc("cancel_flows", appId, id, flow))) {
    return c.json({ error: `Cancel flow "${id}" already exists` }, 409);
  }
  return c.json(flow, 201);
});

// GET /apps/:appId/cancel-flows/:flowId
cancelFlows.get("/:flowId", async (c) => {
  const flow = await getDoc("cancel_flows", c.req.param("appId")!, c.req.param("flowId"));
  if (!flow) return c.json(notFound, 404);
  return c.json({ ...flow, capabilities: capabilities() });
});

// PATCH /apps/:appId/cancel-flows/:flowId
// Body: { name?, status?, steps? }. `steps` replaces the whole list.
cancelFlows.patch("/:flowId", async (c) => {
  const appId = c.req.param("appId")!;
  const payload = omit(await readObject(c), ["id", "app_id", "created_at", "updated_at", "capabilities", "last_30_days"]);
  if (payload.status !== undefined && !STATUSES.includes(payload.status)) {
    return c.json({ error: "status must be active or draft" }, 400);
  }
  if (payload.name !== undefined) payload.name = String(payload.name).trim().slice(0, 120) || "Cancel flow";
  if (payload.steps !== undefined) payload.steps = validateSteps(payload.steps, await loadFlowCatalog(appId));
  const allowed = Object.fromEntries(Object.entries(payload).filter(([k]) => ["name", "status", "steps"].includes(k)));
  const change = await changeDoc("cancel_flows", appId, c.req.param("flowId"), (doc) => ({
    ...doc,
    ...allowed,
    updated_at: new Date().toISOString(),
  }));
  if (!change) return c.json(notFound, 404);
  return c.json({ ...change.after, capabilities: capabilities() });
});

// DELETE /apps/:appId/cancel-flows/:flowId
cancelFlows.delete("/:flowId", async (c) => {
  const deleted = await deleteDoc("cancel_flows", c.req.param("appId")!, c.req.param("flowId"));
  if (!deleted) return c.json(notFound, 404);
  return c.json(deleted);
});

// GET /apps/:appId/cancel-flows/:flowId/stats?days=30
// Save rate, revenue kept, why people leave and which offers work.
cancelFlows.get("/:flowId/stats", async (c) => {
  const appId = c.req.param("appId")!;
  const flowId = c.req.param("flowId");
  const days = Math.min(Math.max(parseInt(c.req.query("days") ?? "30", 10) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  // Open sessions older than an hour count as abandoned.
  const outcome = sql`case when status = 'open' and created_at < now() - interval '1 hour' then 'abandoned' else status end`;
  const [totals, reasons, offers, daily] = await Promise.all([
    sql`
      select ${outcome} as outcome, count(*)::int as count,
             coalesce(sum((data -> 'account' ->> 'monthly_value')::numeric), 0)::float8 as monthly_value
      from cancel_sessions where app_id = ${appId} and flow_id = ${flowId} and created_at >= ${since}
      group by 1`,
    sql`
      select a ->> 'step' as step, a ->> 'step_title' as step_title, a ->> 'answer' as answer, a ->> 'label' as label,
             count(*)::int as count,
             count(*) filter (where s.status = 'saved')::int as saved,
             count(*) filter (where s.status = 'cancelled')::int as cancelled
      from cancel_sessions s, jsonb_array_elements(s.data -> 'answers') a
      where s.app_id = ${appId} and s.flow_id = ${flowId} and s.created_at >= ${since} and a ->> 'answer' is not null
      group by 1, 2, 3, 4
      order by count desc`,
    sql`
      select data -> 'offer' ->> 'kind' as kind, data -> 'offer' ->> 'source' as source,
             count(*)::int as shown,
             count(*) filter (where data -> 'offer' ->> 'status' = 'accepted')::int as accepted
      from cancel_sessions
      where app_id = ${appId} and flow_id = ${flowId} and created_at >= ${since} and data -> 'offer' is not null
        and data -> 'offer' <> 'null'::jsonb
      group by 1, 2
      order by shown desc`,
    sql`
      select date_trunc('day', created_at)::date::text as day, count(*)::int as sessions,
             count(*) filter (where status = 'saved')::int as saved,
             count(*) filter (where status = 'cancelled')::int as cancelled
      from cancel_sessions where app_id = ${appId} and flow_id = ${flowId} and created_at >= ${since}
      group by 1 order by 1`,
  ]);

  const count = (o: string) => totals.find((t: { outcome: string }) => t.outcome === o)?.count ?? 0;
  const value = (o: string) => totals.find((t: { outcome: string }) => t.outcome === o)?.monthly_value ?? 0;
  const started = totals.reduce((sum: number, t: { count: number }) => sum + t.count, 0);
  const decided = count("saved") + count("cancelled");
  return c.json({
    days,
    started,
    saved: count("saved"),
    cancelled: count("cancelled"),
    abandoned: count("abandoned"),
    open: count("open"),
    save_rate: decided ? count("saved") / decided : null,
    monthly_revenue_saved: Math.round(value("saved") * 100) / 100,
    monthly_revenue_lost: Math.round(value("cancelled") * 100) / 100,
    reasons,
    offers,
    daily,
  });
});

// POST /apps/:appId/cancel-flows/:flowId/preview-offer
// Body: { steps?, answers: string[], texts?: { [answerId]: string }, account?, dynamic? }.
// The offer a customer would get for these answers, without starting a
// session: for a real account, or a sample one on the first paid plan.
// `steps` previews unsaved edits from the editor. Claude is only asked when
// `dynamic` is true and the offer step has it on.
cancelFlows.post("/:flowId/preview-offer", async (c) => {
  const appId = c.req.param("appId")!;
  const flow = await getDoc("cancel_flows", appId, c.req.param("flowId"));
  if (!flow) return c.json(notFound, 404);
  const body = await readObject(c);
  const steps: Step[] = body.steps ? validateSteps(body.steps, await loadFlowCatalog(appId)) : flow.steps;
  const step = steps.find((s) => s.type === "offer");
  if (!step || step.type !== "offer") return c.json({ offer: null, dynamic: null, static_offer: null, account: null });

  const [plans, incentives, [app]] = await Promise.all([
    listDocs("plans", appId),
    listDocs("incentives", appId),
    sql`select data ->> 'name' as name from apps where id = ${appId}`,
  ]);

  let snapshot: AccountSnapshot;
  let usage: { name: string; usage: number; max: number | null }[] = [];
  if (typeof body.account === "string" && body.account) {
    const account = await getDoc("namespaces", appId, body.account);
    if (!account) return c.json({ error: "Namespace not found" }, 404);
    snapshot = await accountSnapshot(appId, account);
    const plan = await buildNamespacePlan(appId, body.account);
    if (plan && plan !== "plan_not_found") usage = plan.entitlements.map((e) => ({ name: e.name, usage: e.usage, max: e.max }));
  } else {
    snapshot = sampleAccount(plans);
  }

  const answerIds: string[] = Array.isArray(body.answers) ? body.answers.filter((a: unknown) => typeof a === "string") : [];
  const texts: Record<string, string> = typeof body.texts === "object" && body.texts ? body.texts : {};
  const answers = steps.flatMap((s) => {
    if (s.type !== "question") return [];
    const a = s.answers.find((x) => answerIds.includes(x.id));
    return a ? [{ question: s.title, answer: a.label, text: typeof texts[a.id] === "string" ? texts[a.id].slice(0, 1000) : null }] : [];
  });

  const ctx = { account: snapshot, plans, incentives };
  let decide = null;
  if (step.dynamic && body.dynamic === true) {
    decide = await decideOffer({ appName: app?.name ?? "this app", guardrails: step.guardrails, context: ctx, usage, answers });
  }
  const spec = staticSpec(step, answerIds);
  const fallback = spec ? presentOffer(spec, ctx, "static") : null;
  return c.json({
    account: snapshot,
    offer: decide?.offer ?? fallback,
    dynamic: decide ? { used: !!decide.offer, skipped: decide.skipped ?? null } : null,
    static_offer: fallback,
  });
});

// A made-up subscriber on the most expensive monthly plan, for previews.
function sampleAccount(plans: Json[]): AccountSnapshot {
  const priced = plans
    .map((p) => ({ plan: p, price: listPrice(p, "month") }))
    .filter((p): p is { plan: Json; price: number } => p.price !== null && p.price > 0)
    .sort((a, b) => b.price - a.price)[0];
  const price = priced?.price ?? 49;
  return {
    id: "sample",
    name: "Sample customer",
    plan: priced?.plan.id ?? "pro",
    plan_name: priced?.plan.name ?? "Pro",
    created_at: new Date(Date.now() - 300 * 24 * 3600 * 1000).toISOString(),
    subscription: {
      provider: "paypal",
      status: "active",
      interval: "month",
      price,
      currency: priced?.plan.pricingCard?.currency ?? "USD",
      renews_at: new Date(Date.now() + 12 * 24 * 3600 * 1000).toISOString(),
      payments: 10,
      offer_name: null,
    },
    monthly_value: price,
    billing_offers: true,
  };
}

export default cancelFlows;
