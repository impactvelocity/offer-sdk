import { headers } from "next/headers";
import { cache } from "react";
import { DEMO_BLOCKED_AUTH_PATHS, DEMO_READ_ONLY_MESSAGE } from "@/lib/demo";
import { env } from "@/server/env";
import { offerApiMode } from "@/server/offer-api";
import { DEMO_USER, ensureDemoData, localAuth, localHasAdmin } from "./local";
import { proxyAuthRequest, remoteAuthCall } from "./remote";

// Dashboard auth (better-auth + organization plugin = workspaces). Where it runs depends
// on the Offer API mode, but callers see the same functions either way:
//   remote → better-auth in the hosted API, reached through ./remote.ts
//   mock   → better-auth in this process with an in-memory store (./local.ts)

export { DEMO_USER, ensureDemoData };

/** The mock always has the demo workspace; with the hosted API, it's built on first use (see @/server/demo). Its password is public. */
export const demoEnabled = offerApiMode === "mock" || env.DEMO_ENABLED;

/** The shared demo login, which is read-only (see @/lib/demo). */
export const isDemoUser = (user: { email: string } | null | undefined) => user?.email === DEMO_USER.email;

export interface Session {
  user: { id: string; name: string; email: string; image?: string | null };
  session: { id: string; activeOrganizationId?: string | null };
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
}

/** Handles a browser request to /api/auth/*. */
export async function handleAuthRequest(request: Request): Promise<Response> {
  // The API refuses these too; checking here also covers the mock.
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  if (DEMO_BLOCKED_AUTH_PATHS.has(path) && isDemoUser((await getSession())?.user)) {
    return Response.json({ code: "DEMO_READ_ONLY", message: DEMO_READ_ONLY_MESSAGE }, { status: 403 });
  }
  if (offerApiMode === "remote") return proxyAuthRequest(request);
  await ensureDemoData();
  return localAuth().handler(request);
}

/** Whether this install still needs its admin account (the /setup page). The demo login doesn't count. */
export async function needsSetup(): Promise<boolean> {
  if (offerApiMode === "remote") return (await remoteAuthCall<{ needs_setup: boolean }>("GET", "/setup-status")).needs_setup;
  await ensureDemoData();
  return !localHasAdmin();
}

/** Current session for server components and route handlers (deduped per request). */
export const getSession = cache(async (): Promise<Session | null> => {
  if (offerApiMode === "remote") return remoteAuthCall<Session | null>("GET", "/get-session");
  await ensureDemoData();
  return localAuth().api.getSession({ headers: await headers() });
});

/** Workspaces the signed-in user belongs to. */
export const listWorkspaces = cache(async (): Promise<Workspace[]> => {
  if (offerApiMode === "remote") return remoteAuthCall<Workspace[]>("GET", "/organization/list");
  return localAuth().api.listOrganizations({ headers: await headers() });
});

export async function setActiveWorkspace(organizationId: string): Promise<void> {
  if (offerApiMode === "remote") {
    await remoteAuthCall("POST", "/organization/set-active", { organizationId });
    return;
  }
  await localAuth().api.setActiveOrganization({ headers: await headers(), body: { organizationId } });
}
