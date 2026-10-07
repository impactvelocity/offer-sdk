// The shared demo login (DEMO_USER in @/server/offer-api/sample-data). Anyone can sign in
// as it, so it's read-only: the BFF and /api/auth turn its changes away, and the API does
// the same for its account, its workspaces and its apps' secret keys. The agent is off.

export const DEMO_READ_ONLY_MESSAGE = "The demo workspace is read-only. Sign in with your admin account to make changes.";

export const DEMO_AGENT_OFF_MESSAGE = "The agent is off in the demo workspace. Sign in with your admin account to use it.";

/** better-auth routes the demo login may not call: its profile, credentials, sessions, workspaces and members. */
export const DEMO_BLOCKED_AUTH_PATHS = new Set([
  "/update-user",
  "/change-password",
  "/change-email",
  "/delete-user",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  "/organization/create",
  "/organization/update",
  "/organization/delete",
  "/organization/leave",
  "/organization/invite-member",
  "/organization/remove-member",
  "/organization/update-member-role",
]);

// POSTs that only compute a preview, so the demo can still try them.
const DEMO_PREVIEWS = [/^apps\/[^/]+\/offers\/draft-preview$/, /^apps\/[^/]+\/cancel-flows\/[^/]+\/preview-offer$/];

/** Whether the demo login may make this /api/admin request (path segments after /api/admin). */
export function demoAllows(method: string, segments: string[]) {
  if (method === "GET" || method === "HEAD") return true;
  const path = segments.join("/");
  return method === "POST" && DEMO_PREVIEWS.some((re) => re.test(path));
}
