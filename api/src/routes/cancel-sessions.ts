import { type Context, Hono } from "hono";
import sql from "../db/client.ts";
import { changeDoc, getDoc, listDocs } from "../db/docs.ts";
import {
  accountSnapshot,
  type AccountSnapshot,
  findStep,
  nextStepId,
  type OfferContext,
  presentOffer,
  type PresentedOffer,
  publicOffer,
  publicStep,
  staticSpec,
  type Step,
} from "../lib/cancel-flows.ts";
import { decideOffer } from "../lib/decide.ts";
import { applySubscriptionBilling, billingFromSubscription } from "../lib/grants.ts";
import { ApiError, type Json, limitParam, readOptionalJson } from "../lib/http.ts";
import { prefixedId } from "../lib/ids.ts";
import { buildNamespacePlan } from "../lib/namespace-plan.ts";
import { addDuration } from "../lib/offers.ts";
import { requestPause } from "../lib/pauses.ts";
import { cancelSubscription, getSubscription, requireConnection } from "../lib/paypal.ts";
import { cancellableSubscription, paypalCall, startPlanChange } from "../lib/plan-changes.ts";
import { emit, emitAccountChanges } from "../lib/webhooks.ts";

// /apps/:appId/cancel-sessions — a customer going through a cancel flow.
// Called by the SDK with an account token (it can only see its own account's
// sessions), or by the app's server or dashboard with a secret/admin key.
// Every call returns the session view: the current step, the offer if one is
// showing, and what happened.
const cancelSessions = new Hono();

const notFound = { error: "Cancel session not found" };

type Row = {
  id: string;
  app_id: string;
  flow_id: string;
  account_id: string;
  status: "open" | "saved" | "cancelled" | "abandoned";
  data: SessionData;
  created_at: Date;
  completed_at: Date | null;
};

type SessionAnswer = { step: string; step_title: string; answer: string | null; label: string | null; text: string | null };

type SessionData = {
  /** The flow as it was when the session started, so later edits don't break it. */
  flow: { name: string; steps: Step[] };
  current_step: string | null;
  history: string[];
  answers: SessionAnswer[];
  offer: PresentedOffer | null;
  /** Dynamic offer attempt: whether the model's offer was used, or why not. */
  decide: { used: boolean; skipped: string | null } | null;
  account: AccountSnapshot;
  approve_url: string | null;
  result: Json | null;
};

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

// The session as the SDK sees it.
function view(row: Row) {
  const { data } = row;
  const flow = { id: row.flow_id, ...data.flow };
  const step = row.status === "open" ? findStep(flow, data.current_step) : null;
  const steps = data.flow.steps;
  const sub = data.account.subscription;
  return {
    id: row.id,
    status: row.status,
    flow: { id: row.flow_id, name: data.flow.name },
    step: step ? publicStep(step) : null,
    progress: { index: step ? steps.findIndex((s) => s.id === step.id) : steps.length, total: steps.length },
    can_go_back: row.status === "open" && data.history.length > 0,
    offer: step?.type === "offer" || row.status === "saved" ? publicOffer(data.offer) : null,
    approve_url: data.approve_url,
    result: data.result,
    account: {
      id: row.account_id,
      plan_name: data.account.plan_name,
      subscription: sub ? { price: sub.price, currency: sub.currency, interval: sub.interval, renews_at: sub.renews_at } : null,
    },
  };
}

// The full session for the dashboard and webhooks, including why the model
// chose its offer.
export function sessionJson(row: Row) {
  const { data } = row;
  return {
    id: row.id,
    app_id: row.app_id,
    flow_id: row.flow_id,
    account_id: row.account_id,
    status: row.status,
    answers: data.answers,
    offer: data.offer,
    decide: data.decide,
    account: data.account,
    result: data.result,
    created_at: iso(row.created_at),
    completed_at: iso(row.completed_at),
  };
}

async function loadSession(c: Context): Promise<Row> {
  const [row] = await sql`
    select * from cancel_sessions where app_id = ${c.req.param("appId")!} and id = ${c.req.param("sessionId")!}`;
  // An account token never learns that other accounts' sessions exist.
  if (!row || (c.get("accountId") && row.account_id !== c.get("accountId"))) throw new ApiError(404, notFound.error);
  return row as Row;
}

async function saveSession(row: Row) {
  const [saved] = await sql`
    update cancel_sessions
    set status = ${row.status}, data = ${row.data as Json}::jsonb,
        completed_at = ${row.status === "open" ? null : (row.completed_at ?? new Date())}
    where app_id = ${row.app_id} and id = ${row.id}
    returning *`;
  return saved as Row;
}

const requireOpen = (row: Row) => {
  if (row.status !== "open") throw new ApiError(409, `This cancel session is already ${row.status}`);
};

async function offerContext(appId: string, account: AccountSnapshot): Promise<OfferContext> {
  const [plans, incentives] = await Promise.all([listDocs("plans", appId), listDocs("incentives", appId)]);
  return { account, plans, incentives };
}

// Moves the session to a step. Arriving at the offer step works out the offer
// (dynamic first when enabled, else the static one); if nothing applies to
// this account the step is skipped.
async function enterStep(row: Row, stepId: string | null): Promise<Row> {
  const flow = row.data.flow;
  const step = findStep(flow, stepId);
  row.data.current_step = step?.id ?? null;
  if (step?.type !== "offer") return row;
  if (row.data.offer) return row; // going back to it shows the same offer

  const ctx = await offerContext(row.app_id, row.data.account);
  let offer: PresentedOffer | null = null;
  if (step.dynamic) {
    const [plan, [app]] = await Promise.all([
      buildNamespacePlan(row.app_id, row.account_id),
      sql`select data ->> 'name' as name from apps where id = ${row.app_id}`,
    ]);
    const decision = await decideOffer({
      appName: app?.name ?? "this app",
      guardrails: step.guardrails,
      context: ctx,
      usage: plan && plan !== "plan_not_found" ? plan.entitlements.map((e) => ({ name: e.name, usage: e.usage, max: e.max })) : [],
      answers: row.data.answers.map((a) => ({ question: a.step_title, answer: a.label, text: a.text })),
    });
    offer = decision.offer;
    row.data.decide = { used: !!offer, skipped: decision.skipped ?? null };
  }
  if (!offer) {
    const answerIds = row.data.answers.flatMap((a) => (a.answer ? [a.answer] : []));
    const spec = staticSpec(step, answerIds);
    offer = spec ? presentOffer(spec, ctx, "static") : null;
  }
  if (!offer) return enterStep(row, nextStepId(flow, step));
  row.data.offer = offer;
  return row;
}

function currentStep(row: Row, type?: Step["type"]): Step {
  const step = findStep(row.data.flow, row.data.current_step);
  if (!step || (type && step.type !== type)) {
    throw new ApiError(409, type ? `The session is not at a ${type} step` : "The session has no current step");
  }
  return step;
}

// ─── Starting ──────────────────────────────────────────

// POST /apps/:appId/cancel-sessions
// Body: { flow?, account? }. With an account token the account comes from the
// token. Without `flow`, uses the app's active flow (preferring "default").
// Draft flows can be previewed with a secret or admin key.
cancelSessions.post("/", async (c) => {
  const appId = c.req.param("appId")!;
  const body = await readOptionalJson(c);
  const tokenAccount = c.get("accountId");
  const accountId = tokenAccount ?? body.account;
  if (typeof accountId !== "string" || !accountId) return c.json({ error: "account is required" }, 400);
  if (tokenAccount && body.account && body.account !== tokenAccount) return c.json({ error: "account does not match the token" }, 403);

  let flow: Json | null;
  if (typeof body.flow === "string") {
    flow = await getDoc("cancel_flows", appId, body.flow);
    if (flow && flow.status !== "active" && tokenAccount) flow = null;
  } else {
    const active = (await listDocs("cancel_flows", appId)).filter((f) => f.status === "active");
    flow = active.find((f) => f.id === "default") ?? active[0] ?? null;
  }
  if (!flow) return c.json({ error: "No active cancel flow" }, 404);

  const account = await getDoc("namespaces", appId, accountId);
  if (!account) return c.json({ error: "Namespace not found" }, 404);

  const row: Row = {
    id: prefixedId("cxl", 16),
    app_id: appId,
    flow_id: flow.id,
    account_id: accountId,
    status: "open",
    created_at: new Date(),
    completed_at: null,
    data: {
      flow: { name: flow.name, steps: flow.steps },
      current_step: null,
      history: [],
      answers: [],
      offer: null,
      decide: null,
      account: await accountSnapshot(appId, account),
      approve_url: null,
      result: null,
    },
  };
  await enterStep(row, flow.steps[0].id);
  const [created] = await sql`
    insert into cancel_sessions (id, app_id, flow_id, account_id, status, data)
    values (${row.id}, ${appId}, ${row.flow_id}, ${accountId}, 'open', ${row.data as Json}::jsonb)
    returning *`;
  return c.json(view(created as Row), 201);
});

// GET /apps/:appId/cancel-sessions?flow=&account=&status=&limit=
// Secret or admin key: recent sessions, newest first, for the dashboard.
cancelSessions.get("/", async (c) => {
  if (c.get("accountId")) return c.json({ error: "Unauthorized" }, 401);
  const appId = c.req.param("appId")!;
  const { flow = null, account = null, status = null } = c.req.query();
  const rows = await sql`
    select * from cancel_sessions
    where app_id = ${appId}
      and (${flow}::text is null or flow_id = ${flow})
      and (${account}::text is null or account_id = ${account})
      and (${status}::text is null or status = ${status})
    order by created_at desc
    limit ${limitParam(c, 25)}`;
  return c.json((rows as Row[]).map(sessionJson));
});

// GET /apps/:appId/cancel-sessions/:sessionId
cancelSessions.get("/:sessionId", async (c) => {
  const row = await loadSession(c);
  return c.json(c.get("accountId") ? view(row) : { ...view(row), session: sessionJson(row) });
});

// ─── Steps ─────────────────────────────────────────────

// POST /apps/:appId/cancel-sessions/:sessionId/answer
// Body: { step, answer?, text? }. Records the answer to the current question
// or text step and moves on. `step` guards against double submits.
cancelSessions.post("/:sessionId/answer", async (c) => {
  const row = await loadSession(c);
  requireOpen(row);
  const { step: stepId, answer, text } = await readOptionalJson(c);
  const step = currentStep(row);
  if (stepId !== step.id) return c.json({ error: `The current step is "${step.id}"`, view: view(row) }, 409);
  const note = typeof text === "string" && text.trim() ? text.trim().slice(0, 1000) : null;

  let entry: SessionAnswer;
  if (step.type === "question") {
    const choice = step.answers.find((a) => a.id === answer);
    if (!choice) return c.json({ error: "answer must be one of this step's answers" }, 400);
    entry = { step: step.id, step_title: step.title, answer: choice.id, label: choice.label, text: choice.text ? note : null };
  } else if (step.type === "text") {
    if (step.required && !note) return c.json({ error: "text is required" }, 400);
    entry = { step: step.id, step_title: step.title, answer: null, label: null, text: note };
  } else {
    return c.json({ error: `Use /${step.type === "offer" ? "accept or /decline" : "cancel"} for this step` }, 409);
  }

  row.data.answers = [...row.data.answers.filter((a) => a.step !== step.id), entry];
  row.data.history.push(step.id);
  // A different answer can mean a different offer.
  row.data.offer = null;
  row.data.decide = null;
  await enterStep(row, nextStepId(row.data.flow, step, entry.answer));
  return c.json(view(await saveSession(row)));
});

// POST /apps/:appId/cancel-sessions/:sessionId/back
cancelSessions.post("/:sessionId/back", async (c) => {
  const row = await loadSession(c);
  requireOpen(row);
  const previous = row.data.history.pop();
  if (!previous) return c.json({ error: "This is the first step" }, 409);
  row.data.current_step = previous;
  // Back to the offer after declining it: it can be accepted again.
  if (findStep(row.data.flow, previous)?.type === "offer" && row.data.offer?.status === "declined") {
    row.data.offer.status = "shown";
  }
  return c.json(view(await saveSession(row)));
});

// POST /apps/:appId/cancel-sessions/:sessionId/decline
// Turns down the offer and moves on (usually to the confirm step).
cancelSessions.post("/:sessionId/decline", async (c) => {
  const row = await loadSession(c);
  requireOpen(row);
  const step = currentStep(row, "offer");
  if (row.data.offer) row.data.offer.status = "declined";
  row.data.history.push(step.id);
  await enterStep(row, nextStepId(row.data.flow, step));
  return c.json(view(await saveSession(row)));
});

// POST /apps/:appId/cancel-sessions/:sessionId/accept
// Body: { return_url?, cancel_url? } (where PayPal sends the customer back).
// Applies the offer. Discounts and downgrades change the PayPal subscription
// and return `approve_url`: the customer approves the new price on PayPal.
// Pauses run as a Render Workflow when configured. Incentives apply at once.
cancelSessions.post("/:sessionId/accept", async (c) => {
  const row = await loadSession(c);
  requireOpen(row);
  currentStep(row, "offer");
  const offer = row.data.offer;
  if (!offer || offer.status !== "shown") return c.json({ error: "There is no offer to accept" }, 409);
  const { return_url, cancel_url } = await readOptionalJson(c);
  const appId = row.app_id;
  const accountId = row.account_id;
  const d = offer.details;

  let result: Json;
  switch (offer.kind) {
    case "discount": {
      const account = await getDoc("namespaces", appId, accountId);
      const change = await startPlanChange(appId, accountId, {
        plan: account!.plan,
        discount: { percent: d.percent, cycles: d.cycles },
        return_url,
        cancel_url,
      });
      result = { approve_url: change.approve_url, pending_approval: true };
      break;
    }
    case "downgrade": {
      const change = await startPlanChange(appId, accountId, { plan: d.plan, return_url, cancel_url });
      result = { approve_url: change.approve_url, pending_approval: true, apply_after: change.pending_change.apply_after };
      break;
    }
    case "pause": {
      const pause = await requestPause(appId, accountId, { months: d.months, session_id: row.id, reason: "Paused from the cancel flow" });
      result = { ...pause, months: d.months, resume_at: addDuration(new Date(), `P${d.months}M`).toISOString() };
      break;
    }
    case "incentive": {
      const endsAt = addDuration(new Date(), `P${d.months}M`).toISOString();
      const change = await changeDoc("namespaces", appId, accountId, (doc) => ({
        ...doc,
        incentive: d.incentive,
        incentive_expires_at: endsAt,
      }));
      if (!change) throw new ApiError(404, "Namespace not found");
      await emitAccountChanges(appId, change.before, change.after);
      result = { incentive: d.incentive, ends_at: endsAt };
      break;
    }
  }

  offer.status = "accepted";
  offer.result = result;
  row.data.result = { outcome: "saved", ...result };
  row.data.approve_url = result.approve_url ?? null;
  row.status = "saved";
  row.completed_at = new Date();
  const saved = await saveSession(row);
  const account = await getDoc("namespaces", appId, accountId);
  await emit(appId, "cancel_flow.saved", { object: sessionJson(saved), account });
  return c.json(view(saved));
});

// POST /apps/:appId/cancel-sessions/:sessionId/cancel
// The confirm step: cancels the customer's PayPal subscription (the account
// moves to the free plan) and sends `cancel_flow.cancelled`. Accounts billed
// elsewhere are only marked; the app cancels them on that webhook.
cancelSessions.post("/:sessionId/cancel", async (c) => {
  const row = await loadSession(c);
  requireOpen(row);
  currentStep(row, "confirm");
  const appId = row.app_id;

  const reason =
    row.data.answers
      .map((a) => a.label ?? a.text)
      .filter(Boolean)
      .join("; ")
      .slice(0, 127) || "Cancelled from the cancel flow";

  let billing: "paypal" | "external" = "external";
  const account = await getDoc("namespaces", appId, row.account_id);
  const sub = account?.subscription;
  if (sub?.provider === "paypal" && ["active", "suspended"].includes(sub.status) && sub.interval !== "once") {
    const { sub: live } = await cancellableSubscription(appId, row.account_id);
    const conn = await requireConnection(appId);
    await paypalCall(() => cancelSubscription(conn, live.provider_id, reason));
    const state = billingFromSubscription(await paypalCall(() => getSubscription(conn, live.provider_id)));
    await applySubscriptionBilling(appId, live.provider_id, state);
    billing = "paypal";
  }

  row.data.result = { outcome: "cancelled", billing };
  row.status = "cancelled";
  row.completed_at = new Date();
  const saved = await saveSession(row);
  await emit(appId, "cancel_flow.cancelled", {
    object: sessionJson(saved),
    account: await getDoc("namespaces", appId, row.account_id),
  });
  return c.json(view(saved));
});

// POST /apps/:appId/cancel-sessions/:sessionId/close
// The customer closed the flow without cancelling. Stays saved/cancelled if
// it already finished.
cancelSessions.post("/:sessionId/close", async (c) => {
  const row = await loadSession(c);
  if (row.status !== "open") return c.json(view(row));
  row.status = "abandoned";
  row.completed_at = new Date();
  return c.json(view(await saveSession(row)));
});

export default cancelSessions;
