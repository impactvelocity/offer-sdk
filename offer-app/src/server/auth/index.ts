import { headers } from "next/headers";
import { cache } from "react";
import { env } from "@/server/env";
import { offerApiMode } from "@/server/offer-api";
import { DEMO_USER, ensureDemoData, localAuth } from "./local";
import { proxyAuthRequest, remoteAuthCall } from "./remote";

// Dashboard auth (better-auth + organization plugin = workspaces). Where it runs depends
// on the Offer API mode, but callers see the same functions either way:
//   remote → better-auth in the hosted API, reached through ./remote.ts
//   mock   → better-auth in this process with an in-memory store (./local.ts)

export { DEMO_USER, ensureDemoData };

/** The mock always has the demo workspace; with the hosted API, it's built on first use (see @/server/demo). Its password is public. */
export const demoEnabled = offerApiMode === "mock" || env.DEMO_ENABLED;

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
  if (offerApiMode === "remote") return proxyAuthRequest(request);
  await ensureDemoData();
  return localAuth().handler(request);
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
