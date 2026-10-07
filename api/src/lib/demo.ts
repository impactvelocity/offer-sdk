import sql from "../db/client.ts";

// The shared demo login (offer-app's DEMO_USER, created by `pnpm seed:demo`). Anyone can
// sign in as it, so its account and workspace are locked (see dashboard-auth.ts), and the
// secret keys of its workspace's apps, which the dashboard shows, can only read.
export const DEMO_EMAIL = "demo@offersdk.dev";

export const DEMO_READ_ONLY_MESSAGE = "The demo workspace is read-only. Sign in with your admin account to make changes.";

// App ids don't move between workspaces, so a lookup holds until the process restarts.
const demoApps = new Map<string, boolean>();

/** Whether the app belongs to a workspace the demo login is a member of. */
export async function isDemoApp(appId: string): Promise<boolean> {
  const known = demoApps.get(appId);
  if (known !== undefined) return known;
  const [row] = await sql`
    select exists (
      select 1 from orgs o
      join auth_member m on m."organizationId" = o.id
      join auth_user u on u.id = m."userId"
      where u.email = ${DEMO_EMAIL} and o.data -> 'app_ids' ? ${appId}
    ) as demo`;
  demoApps.set(appId, row.demo);
  return row.demo;
}
