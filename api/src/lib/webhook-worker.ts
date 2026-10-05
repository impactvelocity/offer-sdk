import { attemptDelivery, claimDueDeliveries, onDeliveriesQueued, pruneEvents } from "./webhooks.ts";

const POLL_MS = 2_000;
const BATCH_SIZE = 20;
const PRUNE_MS = 60 * 60 * 1000;

// Sends due webhook deliveries in the background. Polls every couple of
// seconds (retries, other instances' events) and is woken by emit() so new
// deliveries go out right away. Returns a function that stops it and waits for
// in-flight attempts.
export function startWebhookWorker() {
  let stopped = false;
  let running: Promise<void> | null = null;
  let again = false;

  async function drain() {
    while (!stopped) {
      const ids = await claimDueDeliveries(BATCH_SIZE);
      await Promise.all(
        ids.map((id) => attemptDelivery(id).catch((err) => console.error(`webhook delivery ${id} failed:`, err))),
      );
      if (ids.length < BATCH_SIZE) break; // a full batch means more may be due
    }
  }

  // Overlapping wake-ups collapse into one more pass after the current one.
  function run() {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    running = drain()
      .catch((err) => console.error("webhook worker:", err))
      .finally(() => {
        running = null;
        if (again) {
          again = false;
          run();
        }
      });
  }

  const prune = () => pruneEvents().catch((err) => console.error("webhook prune:", err));

  onDeliveriesQueued(run);
  const pollTimer = setInterval(run, POLL_MS);
  const pruneTimer = setInterval(prune, PRUNE_MS);
  run();
  prune();

  return async function stop() {
    stopped = true;
    clearInterval(pollTimer);
    clearInterval(pruneTimer);
    onDeliveriesQueued(() => {});
    await running;
  };
}
