import { Render } from "@renderinc/sdk";
import sql from "../db/client.ts";
import { changeDoc, getDoc, listDocs } from "../db/docs.ts";
import { ApiError, type Json } from "./http.ts";
import { addDuration } from "./offers.ts";
import { activateSubscription, requireConnection, suspendSubscription } from "./paypal.ts";
import { activeSubscription, paypalCall } from "./plan-changes.ts";
import { emit, emitAccountChanges } from "./webhooks.ts";

// Pausing a PayPal subscription for a few months: billing is suspended in
// PayPal, the account drops to the free plan (if there is one) and
// `subscription.pause.resume_at` records when it comes back.
//
// With RENDER_API_KEY and RENDER_WORKFLOW_SLUG set, pauses run as Render
// Workflow tasks (../workflows): `pause-subscription` when a customer accepts,
// and, whenever pauses are due, `resume-due-pauses`, which fans out one
// `resume-subscription` task per account, each with its own retries. Without
// them (local dev, tests), pauses apply inline and the same timer resumes
// them in-process.

export const MAX_PAUSE_MONTHS = 12;

export const workflowsEnabled = () => !!process.env.RENDER_API_KEY && !!process.env.RENDER_WORKFLOW_SLUG;

let render: Render | null = null;
async function startTask(name: string, args: unknown[]) {
  render ??= new Render();
  const run = await render.workflows.startTask(`${process.env.RENDER_WORKFLOW_SLUG}/${name}`, args);
  return run.taskRunId;
}

export type PauseRequest = { months: number; session_id?: string | null; reason?: string };

// Applies a pause now: suspends in PayPal and moves the account to the free plan.
export async function pauseSubscription(appId: string, namespaceId: string, req: PauseRequest) {
  const { months } = req;
  if (!Number.isInteger(months) || months < 1 || months > MAX_PAUSE_MONTHS) {
    throw new ApiError(400, `months must be an integer from 1 to ${MAX_PAUSE_MONTHS}`);
  }
  const { sub } = await activeSubscription(appId, namespaceId);
  const conn = await requireConnection(appId);
  await paypalCall(() => suspendSubscription(conn, sub.provider_id, (req.reason ?? `Paused for ${months} months`).slice(0, 127)));

  const freePlan = (await listDocs("plans", appId)).find((p) => p.isFree)?.id ?? null;
  const now = new Date();
  const change = await changeDoc("namespaces", appId, namespaceId, (doc) => ({
    ...doc,
    plan: freePlan ?? doc.plan,
    subscription: {
      ...doc.subscription,
      status: "suspended",
      pause: {
        months,
        paused_at: now.toISOString(),
        resume_at: addDuration(now, `P${months}M`).toISOString(),
        resume_plan: doc.plan,
        session_id: req.session_id ?? null,
      },
    },
  }));
  if (!change) throw new ApiError(404, "Namespace not found");
  await emitAccountChanges(appId, change.before, change.after);
  await emit(appId, "subscription.paused", { object: change.after, previous: { plan: change.before.plan } });
  return change.after;
}

// Ends a pause (when it's due, or early): reactivates billing in PayPal and
// puts the account back on the plan it paused.
export async function resumeSubscription(appId: string, namespaceId: string) {
  const namespace = await getDoc("namespaces", appId, namespaceId);
  if (!namespace) throw new ApiError(404, "Namespace not found");
  const sub = namespace.subscription;
  if (!sub?.pause) throw new ApiError(409, "This account's subscription is not paused");

  const conn = await requireConnection(appId);
  await paypalCall(() => activateSubscription(conn, sub.provider_id, "Pause ended"));

  const change = await changeDoc("namespaces", appId, namespaceId, (doc) => {
    const { pause, ...rest } = doc.subscription;
    return {
      ...doc,
      plan: pause.resume_plan ?? doc.plan,
      subscription: { ...rest, status: "active", last_pause: { ...pause, resumed_at: new Date().toISOString() } },
    };
  });
  await emitAccountChanges(appId, change!.before, change!.after);
  await emit(appId, "subscription.resumed", { object: change!.after, previous: { plan: change!.before.plan } });
  return change!.after;
}

// Starts a pause the customer accepted: as a Render Workflow run when
// configured, otherwise right away.
export async function requestPause(appId: string, namespaceId: string, req: PauseRequest) {
  await activeSubscription(appId, namespaceId); // fail fast, before a run is queued
  if (workflowsEnabled()) {
    const runId = await startTask("pause-subscription", [{ app_id: appId, account_id: namespaceId, ...req }]);
    return { mode: "workflow" as const, task_run_id: runId };
  }
  await pauseSubscription(appId, namespaceId, req);
  return { mode: "inline" as const, task_run_id: null };
}

// Accounts whose pause has run its course, across all apps.
export async function duePauses(limit = 100): Promise<{ app_id: string; account_id: string; resume_at: string }[]> {
  return sql`
    select app_id, id as account_id, data -> 'subscription' -> 'pause' ->> 'resume_at' as resume_at
    from namespaces
    where data -> 'subscription' -> 'pause' ->> 'resume_at' <= ${new Date().toISOString()}
    order by 3
    limit ${limit}`;
}

const POLL_MS = Number(process.env.PAUSE_WORKER_INTERVAL_MS ?? (workflowsEnabled() ? 60 : 10) * 60 * 1000);

// Checks for due pauses on a timer. With Render Workflows it starts one
// `resume-due-pauses` run when any are due; otherwise it resumes them here.
export function startPauseWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const due = await duePauses(workflowsEnabled() ? 1 : 100);
      if (!due.length) return;
      if (workflowsEnabled()) {
        console.log(`pauses due: started resume-due-pauses run ${await startTask("resume-due-pauses", [])}`);
        return;
      }
      for (const d of due) {
        await resumeSubscription(d.app_id, d.account_id).catch((err) =>
          console.error(`resume ${d.app_id}/${d.account_id} failed:`, err),
        );
      }
    } catch (err) {
      console.error("pause worker:", err);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, POLL_MS);
  tick();
  return () => clearInterval(timer);
}
