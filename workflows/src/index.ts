import { task, type TaskContext } from "@renderinc/sdk/workflows";
import { api, Skipped } from "./api.ts";

// Render Workflow tasks for pausing subscriptions from the cancel flow.
//
//   pause-subscription   started by the API when a customer accepts a pause
//   resume-due-pauses    started by the API's timer when pauses are due;
//                        fans out one resume-subscription run per account
//   resume-subscription  restarts billing and restores the plan
//
// A pause can last months, longer than a task may run (24h), so nothing here
// sleeps: the resume date lives on the account and the API checks for due
// pauses. Each run is a separate task with its own retries, so one account's
// PayPal error never holds up the rest.

const retry = { maxRetries: 6, waitDurationMs: 30_000, backoffScaling: 2 };

type Account = { app_id: string; account_id: string };
type PauseInput = Account & { months: number; session_id?: string | null; reason?: string };
type Outcome = Account & { status: "done" | "skipped"; detail?: string; subscription?: unknown };

async function settle(input: Account, run: () => Promise<{ subscription: unknown }>): Promise<Outcome> {
  try {
    const { subscription } = await run();
    return { ...input, status: "done", subscription };
  } catch (err) {
    // Already paused / already resumed / account gone: done, nothing to retry.
    if (err instanceof Skipped) return { ...input, status: "skipped", detail: err.message };
    throw err;
  }
}

task(
  { name: "pause-subscription", retry, timeoutSeconds: 300 },
  async function pauseSubscription(_ctx: TaskContext, input: PauseInput): Promise<Outcome> {
    return settle(input, () => api("POST", "/pauses/apply", input));
  },
);

const resumeSubscription = task(
  { name: "resume-subscription", retry, timeoutSeconds: 300 },
  async function resumeSubscription(_ctx: TaskContext, input: Account): Promise<Outcome> {
    return settle(input, () => api("POST", "/pauses/resume", { app_id: input.app_id, account_id: input.account_id }));
  },
);

task(
  { name: "resume-due-pauses", retry: { maxRetries: 2, waitDurationMs: 60_000, backoffScaling: 2 }, timeoutSeconds: 3600 },
  async function resumeDuePauses(ctx: TaskContext) {
    const due = await api<(Account & { resume_at: string })[]>("GET", "/pauses/due?limit=100");
    const results = await Promise.allSettled(
      due.map((d) => ctx.run(resumeSubscription, { app_id: d.app_id, account_id: d.account_id })),
    );
    const failed = results.flatMap((r, i) =>
      r.status === "rejected" ? [{ ...due[i], error: r.reason instanceof Error ? r.reason.message : String(r.reason) }] : [],
    );
    return { due: due.length, resumed: due.length - failed.length, failed };
  },
);
