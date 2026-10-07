import { listWorkspaces } from "@/server/auth";
import { backendOrg, offerApi } from "@/server/offer-api";

// The OAuth consent step for MCP clients. The hosted API runs the authorization server
// (api/src/routes/oauth.ts) and sends the browser here to sign in and approve; these
// helpers read the pending request and work out which apps the person may connect.

export type McpAccessLevel = "read" | "write" | "full";

export interface ConsentRequest {
  id: string;
  client: { id: string; name: string; client_uri: string | null; logo_uri: string | null };
  redirect_uri: string;
  /** Null when the client didn't say which server it's connecting to: the person picks. */
  app_id: string | null;
  app_name: string | null;
  requested_level: McpAccessLevel | null;
  server: { enabled: boolean; access_level: McpAccessLevel } | null;
  expires_at: string;
}

export interface ConsentApp {
  id: string;
  name: string;
  workspace: string;
}

export const getConsentRequest = (id: string) => offerApi<ConsentRequest>("GET", `/oauth/requests/${encodeURIComponent(id)}`);

/** Every app in the signed-in person's workspaces. */
export async function consentApps(): Promise<ConsentApp[]> {
  const workspaces = await listWorkspaces();
  const lists = await Promise.all(
    workspaces.map(async (ws) => {
      await backendOrg(ws.id);
      const apps = await offerApi<{ id: string; name: string }[]>("GET", `/orgs/${encodeURIComponent(ws.id)}/apps`);
      return apps.map((a) => ({ id: a.id, name: a.name, workspace: ws.name }));
    }),
  );
  return lists.flat();
}

export const isAccessLevel = (value: unknown): value is McpAccessLevel => value === "read" || value === "write" || value === "full";
