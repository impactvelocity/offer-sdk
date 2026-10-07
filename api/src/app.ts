import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { apiReference } from "@scalar/hono-api-reference";
import sql from "./db/client.ts";
import { adminAuth, appAuth } from "./lib/auth.ts";
import { handleDashboardAuth, hasAdmin } from "./lib/dashboard-auth.ts";
import { ApiError } from "./lib/http.ts";
import spec from "./lib/openapi.ts";
import accountAddons from "./routes/account-addons.ts";
import addons from "./routes/addons.ts";
import agentThreads from "./routes/agent-threads.ts";
import analytics from "./routes/analytics.ts";
import cancelFlows from "./routes/cancel-flows.ts";
import cancelSessions from "./routes/cancel-sessions.ts";
import apps from "./routes/apps.ts";
import checkouts from "./routes/checkouts.ts";
import entitlements from "./routes/entitlements.ts";
import events, { eventTypes } from "./routes/events.ts";
import historyImport from "./routes/history-import.ts";
import incentives from "./routes/incentives.ts";
import { createMcpServer, mcpAdmin } from "./routes/mcp.ts";
import namespaces from "./routes/namespaces.ts";
import { oauth, wellKnown } from "./routes/oauth.ts";
import offers from "./routes/offers.ts";
import orgs from "./routes/orgs.ts";
import paypal from "./routes/paypal.ts";
import paypalWebhooks from "./routes/paypal-webhooks.ts";
import pauses from "./routes/pauses.ts";
import plans from "./routes/plans.ts";
import subscriptions from "./routes/subscriptions.ts";
import usage from "./routes/usage.ts";
import webhooks from "./routes/webhooks.ts";

const app = new Hono();

app.use("*", cors());

app.get("/", (c) => c.text("Offer API."));

// Render health check: confirms the database is reachable.
app.get("/health", async (c) => {
  await sql`select 1`;
  return c.json({ ok: true });
});

app.get("/openapi.json", (c) => c.json(spec));

app.get("/docs", apiReference({ pageTitle: "Offer API", url: "/openapi.json" }));

// Webhook event catalog, public so docs and dashboards can show it.
app.route("/event-types", eventTypes);

// PayPal's notifications for each app; verified with PayPal, not by API key.
app.route("/paypal/webhooks", paypalWebhooks);

// MCP: each app's server, plus OAuth for the clients that connect to it (see src/mcp).
// The server is mounted ahead of appAuth because it also takes OAuth access tokens.
app.route("/.well-known", wellKnown);
app.route("/oauth", oauth);
// Browser-based clients need to read the session id and the auth challenge.
app.use("/apps/:appId/mcp", cors({ origin: "*", exposeHeaders: ["Mcp-Session-Id", "WWW-Authenticate"] }));
app.route("/apps/:appId/mcp", createMcpServer((req) => app.fetch(req)));

// Per-app routes need the admin key, the app's API key, or (for a few routes)
// its public key. POST /apps is intentionally open: there is no appId yet.
app.use("/apps/:appId", appAuth);
app.use("/apps/:appId/*", appAuth);

app.use("/orgs", adminAuth);
app.use("/orgs/*", adminAuth);
app.use("/pauses/*", adminAuth);
// Backdated history import is admin-only (app keys can't rewrite the past).
app.use("/apps/:appId/import", adminAuth);

// Dashboard sign-in. Only the dashboard calls this, proxying its own /api/auth/*
// with the admin key; browsers never reach it directly.
app.use("/api/auth/*", adminAuth);
// Before anyone signs in: whether the install still needs its admin account.
app.get("/api/auth/setup-status", async (c) => c.json({ needs_setup: !(await hasAdmin()) }));
app.on(["GET", "POST"], "/api/auth/*", (c) => handleDashboardAuth(c.req.raw));

app.route("/apps", apps);
app.route("/orgs", orgs);
app.route("/apps/:appId/plans", plans);
app.route("/apps/:appId/entitlements", entitlements);
app.route("/apps/:appId/addons", addons);
app.route("/apps/:appId/incentives", incentives);
app.route("/apps/:appId/namespaces", namespaces);
app.route("/apps/:appId/namespaces/:namespaceId/usage", usage);
app.route("/apps/:appId/namespaces/:namespaceId/subscription", subscriptions);
app.route("/apps/:appId/namespaces/:namespaceId/addons", accountAddons);
app.route("/apps/:appId/offers", offers);
app.route("/apps/:appId/checkouts", checkouts);
app.route("/apps/:appId/paypal", paypal);
app.route("/apps/:appId/analytics", analytics);
app.route("/apps/:appId/webhooks", webhooks);
app.route("/apps/:appId/events", events);
app.route("/apps/:appId/import", historyImport);
app.route("/apps/:appId/agent/threads", agentThreads);
app.route("/apps/:appId/cancel-flows", cancelFlows);
app.route("/apps/:appId/cancel-sessions", cancelSessions);
app.route("/apps/:appId/mcp", mcpAdmin);
app.route("/pauses", pauses);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: err.message }, err.status);
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
