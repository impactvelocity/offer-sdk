import "./dev-env.ts";
import app from "./app.ts";
import sql from "./db/client.ts";
import { migrate } from "./db/migrate.ts";
import { closeDashboardAuth } from "./lib/dashboard-auth.ts";
import { startWebhookWorker } from "./lib/webhook-worker.ts";

if (process.env.MIGRATE_ON_BOOT !== "false") await migrate();

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  hostname: "0.0.0.0",
  fetch: app.fetch,
});

// Sends webhook deliveries. Every instance may run one; set WEBHOOKS_WORKER=false
// to leave delivery to other instances.
const stopWebhookWorker = process.env.WEBHOOKS_WORKER !== "false" ? startWebhookWorker() : null;

console.log(`Offer API listening on ${server.url}`);

// Render sends SIGTERM on deploys; finish in-flight requests and webhook
// attempts, then close the pools.
process.on("SIGTERM", async () => {
  await server.stop();
  await stopWebhookWorker?.();
  await Promise.all([sql.close(), closeDashboardAuth()]);
  process.exit(0);
});
