import { DEMO_AGENT_OFF_MESSAGE } from "@/lib/demo";
import { getSession, isDemoUser } from "@/server/auth";
import { offerApi, OfferApiError } from "@/server/offer-api";

// Agent routes use the BFF's access rule: a signed-in user, and the app must belong to
// their active workspace. Threads are additionally private to the user who started them.
// The agent is off on the shared demo login, which anyone can use, to keep the model key's spend private.

export const agentError = (status: number, error: string) => Response.json({ error }, { status });

export type AgentAccess = { userId: string; appId: string; appName: string };

/** The caller's access to an app's agent, or the error Response to return. */
export async function agentAccess(appId: string | null | undefined): Promise<AgentAccess | Response> {
  const session = await getSession();
  if (!session) return agentError(401, "Not signed in");
  if (isDemoUser(session.user)) return agentError(403, DEMO_AGENT_OFF_MESSAGE);
  const orgId = session.session.activeOrganizationId;
  if (!orgId) return agentError(403, "No active workspace");
  if (!appId) return agentError(400, "appId is required");

  try {
    const org = await offerApi<{ app_ids: string[] }>("GET", `/orgs/${encodeURIComponent(orgId)}`);
    if (!org.app_ids.includes(appId)) return agentError(404, "App not found");
    const app = await offerApi<{ name: string }>("GET", `/apps/${encodeURIComponent(appId)}`);
    return { userId: session.user.id, appId, appName: app.name };
  } catch (e) {
    if (e instanceof OfferApiError) return agentError(e.status, e.message);
    throw e;
  }
}
