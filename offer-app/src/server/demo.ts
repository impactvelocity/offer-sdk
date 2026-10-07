import { DEMO_USER, ensureDemoData } from "@/server/auth";
import { remoteAuthCallAs } from "@/server/auth/remote";
import { backendOrg, createWorkspaceApp, offerApiMode } from "@/server/offer-api";
import { DEMO_APPS } from "@/server/offer-api/sample-data";

// The shared workspace behind "Explore the demo workspace" (DEMO_ENABLED): the demo
// login, its Acme Labs workspace and the sample apps, with catalogs, accounts, months
// of usage history, saved reports, an offer and a cancel flow. The mock builds it in
// memory. With the hosted API it's built the first time someone opens the demo, and
// again whenever its workspace has no apps left (`pnpm seed:demo --reset` deletes them).

const WORKSPACE_SLUG = "offer-sdk-demo";

let workspaceId: string | undefined;
let running: Promise<void> | undefined;

/** Makes sure the demo workspace exists and has its apps. Call from a request handler. */
export function ensureDemoWorkspace(): Promise<void> {
  if (offerApiMode === "mock") return ensureDemoData();
  // Concurrent visitors share one run, so the apps are only created once.
  return (running ??= seedDemoWorkspace().finally(() => (running = undefined)));
}

async function seedDemoWorkspace() {
  workspaceId ??= await demoWorkspaceId();
  if ((await backendOrg(workspaceId)).app_ids.length) return;
  for (const { name, sample } of DEMO_APPS) await createWorkspaceApp(workspaceId, { name, sample });
  console.info(`[demo] Seeded the ${DEMO_USER.workspace} workspace (${DEMO_APPS.map((a) => a.name).join(", ")})`);
}

/** Signs in as the demo user (signing it up the first time) and returns its workspace, created if missing. */
async function demoWorkspaceId(): Promise<string> {
  const { name, email, password, workspace } = DEMO_USER;
  let auth = await remoteAuthCallAs("", "POST", "/sign-in/email", { email, password });
  if (auth.status === 401) auth = await remoteAuthCallAs("", "POST", "/sign-up/email", { name, email, password });
  if (auth.status !== 200) {
    throw new Error(`Couldn't sign in as ${email} (${auth.status}): ${JSON.stringify(auth.data)}. If it exists with another password, delete that user.`);
  }

  const { cookie } = auth;
  const { data: workspaces } = await remoteAuthCallAs<{ id: string; slug: string }[]>(cookie, "GET", "/organization/list");
  const existing = workspaces?.find((w) => w.slug === WORKSPACE_SLUG) ?? workspaces?.[0];
  if (existing) return existing.id;

  const created = await remoteAuthCallAs<{ id: string }>(cookie, "POST", "/organization/create", { name: workspace, slug: WORKSPACE_SLUG });
  if (!created.data?.id) throw new Error(`Couldn't create the demo workspace (${created.status}): ${JSON.stringify(created.data)}`);
  return created.data.id;
}
