// Seeds the shared demo workspace for previews (judges, prospects): the demo login,
// its "Acme Labs" workspace, and two sample apps (a SaaS and an online course) with
// their catalogs, ~6 months of accounts and usage history, and saved reports.
//
//   pnpm seed:demo                                          # local dashboard (http://localhost:6768)
//   APP_URL=https://offer-app.onrender.com pnpm seed:demo   # a deployed dashboard
//   pnpm seed:demo --reset                                  # rebuild the apps, undoing visitors' changes
//
// It goes through the dashboard like a browser (sign in, then the /api/admin BFF), so it
// needs nothing but the dashboard's URL. The dashboard must use the real API: with
// OFFER_API_URL=mock it seeds its own demo in memory. To show "Explore the demo
// workspace" on the sign-in page, set DEMO_ENABLED=true on the dashboard.

import {
  COURSE_TEMPLATE,
  DEMO_APPS,
  DEMO_USER,
  SAAS_TEMPLATE,
  rng,
  sampleSignupDate,
  sampleUsageHistory,
  type SeededAccount,
} from "../src/server/offer-api/sample-data.ts";

const APP_URL = (process.env.APP_URL ?? "http://localhost:6768").replace(/\/+$/, "");
const RESET = process.argv.includes("--reset");
const WORKSPACE_SLUG = "offer-sdk-demo";
const IMPORT_CHUNK = 5000;
const TEMPLATES = { saas: { template: SAAS_TEMPLATE, seed: 1007 }, course: { template: COURSE_TEMPLATE, seed: 1011 } };

const cookies = new Map<string, string>();

async function call<T = unknown>(method: string, path: string, body?: unknown, ok: number[] = []): Promise<{ status: number; data: T }> {
  let res: Response;
  try {
    res = await fetch(`${APP_URL}${path}`, {
      method,
      headers: {
        origin: APP_URL,
        cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(body !== undefined && { "content-type": "application/json" }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Can't reach the dashboard at ${APP_URL}. Is it running? (Set APP_URL for a deployed one.)`);
  }
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    cookies.set(pair.slice(0, i), pair.slice(i + 1));
  }
  const data = await res.json().catch(() => null);
  if (!res.ok && !ok.includes(res.status)) {
    const message = (data as { error?: string; message?: string } | null)?.error ?? (data as { message?: string } | null)?.message;
    throw new Error(`${method} ${path} → ${res.status}: ${message ?? JSON.stringify(data)}`);
  }
  return { status: res.status, data: data as T };
}

// 1. The demo login.
const { email, password, name } = DEMO_USER;
const signIn = await call("POST", "/api/auth/sign-in/email", { email, password }, [401]);
if (signIn.status === 401) {
  const signUp = await call("POST", "/api/auth/sign-up/email", { name, email, password }, [422]);
  if (signUp.status === 422) throw new Error(`${email} exists with a different password. Delete that user or change DEMO_USER.`);
  console.log(`Created ${email}`);
}

// 2. Its workspace.
const workspaces = (await call<{ id: string; slug: string }[]>("GET", "/api/auth/organization/list")).data;
let workspace = workspaces.find((w) => w.slug === WORKSPACE_SLUG) ?? workspaces[0];
if (!workspace) {
  workspace = (await call<{ id: string; slug: string }>("POST", "/api/auth/organization/create", { name: DEMO_USER.workspace, slug: WORKSPACE_SLUG })).data;
  console.log(`Created the ${DEMO_USER.workspace} workspace`);
}
await call("POST", "/api/auth/organization/set-active", { organizationId: workspace.id });

const { mode } = (await call<{ mode: string }>("GET", "/api/admin/workspace")).data;
if (mode === "mock") {
  throw new Error("This dashboard runs on the mock API (OFFER_API_URL=mock), which seeds its own demo. Point it at the real API.");
}

// 3. Its apps: left alone if they exist, unless --reset.
const existing = (await call<{ id: string; name: string }[]>("GET", "/api/admin/workspace/apps")).data;
if (existing.length && !RESET) {
  console.log(`Already seeded (${existing.map((a) => a.name).join(", ")}). Run with --reset to rebuild the apps.`);
  process.exit(0);
}
for (const app of existing) {
  await call("DELETE", `/api/admin/apps/${app.id}`);
  console.log(`Deleted ${app.name}`);
}

for (const { name: appName, sample } of DEMO_APPS) {
  // The dashboard creates the catalog, accounts and saved reports (same as "Start with sample data").
  const app = (await call<{ id: string }>("POST", "/api/admin/workspace/apps", { name: appName, sample })).data;
  const base = `/api/admin/apps/${app.id}`;

  const accounts: { id: string; plan: string; incentive: string | null }[] = [];
  for (let page = 1; ; page++) {
    const { data } = await call<{ data: typeof accounts; total: number }>("GET", `${base}/namespaces?per_page=100&page=${page}`);
    accounts.push(...data.data);
    if (accounts.length >= data.total || !data.data.length) break;
  }

  // History the API can't produce live: sign-up dates and months of usage.
  const { template, seed } = TEMPLATES[sample];
  const random = rng(seed);
  const seeded: SeededAccount[] = accounts.map((a) => ({ ...a, createdAt: sampleSignupDate(random) }));
  const events = sampleUsageHistory(template, seeded, random);

  await call("POST", `${base}/import`, {
    namespaces: seeded.map((a) => ({ id: a.id, created_at: a.createdAt.toISOString() })),
  });
  for (let i = 0; i < events.length; i += IMPORT_CHUNK) {
    await call("POST", `${base}/import`, { usage_events: events.slice(i, i + IMPORT_CHUNK) });
  }
  console.log(`Created ${appName} (${app.id}): ${accounts.length} accounts, ${events.length} usage events`);
}

console.log(`
Demo workspace ready at ${APP_URL}
  Email:    ${email}
  Password: ${password}
Set DEMO_ENABLED=true on the dashboard to show "Explore the demo workspace" on the sign-in page.`);
