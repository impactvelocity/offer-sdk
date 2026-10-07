import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { organization } from "better-auth/plugins";
import { Pool } from "pg";
import sql from "../db/client.ts";
import { isLocalDev } from "../dev-env.ts";
import { DEMO_EMAIL, DEMO_READ_ONLY_MESSAGE } from "./demo.ts";

// Sign-in for the dashboard (offer-app): better-auth with email/password and the
// organization plugin (workspaces, members, invitations), stored in the auth_* tables.
//
// Browsers never call this service directly. The dashboard proxies its /api/auth/*
// requests here with the admin key (see app.ts), so cookies are set on the
// dashboard's own origin. That's why baseURL is the dashboard's URL.

const appUrl = (process.env.APP_URL ?? "http://localhost:6768").replace(/\/$/, "");

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("BETTER_AUTH_SECRET is not set");
}

// better-auth talks to Postgres through node-postgres; a small pool of its own.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.AUTH_DATABASE_POOL_MAX ?? 5),
});

// Invitations aren't emailed yet: any pending, unexpired invite for the user's
// email is accepted when they sign up or sign in.
async function acceptInvitations(userId: string) {
  await sql`
    with accepted as (
      update auth_invitation i set status = 'accepted'
      from auth_user u
      where u.id = ${userId}
        and lower(i.email) = lower(u.email)
        and i.status = 'pending'
        and i."expiresAt" > now()
      returning i."organizationId", i.role
    )
    insert into auth_member (id, "organizationId", "userId", role, "createdAt")
    select gen_random_uuid()::text, a."organizationId", ${userId}, coalesce(a.role, 'member'), now()
    from accepted a
    where not exists (
      select 1 from auth_member m where m."organizationId" = a."organizationId" and m."userId" = ${userId}
    )`;
}

/** Whether this install has its admin: any account besides the shared demo login. */
export async function hasAdmin(): Promise<boolean> {
  const [row] = await sql`select exists (select 1 from auth_user where lower(email) <> ${DEMO_EMAIL}) as found`;
  return row.found;
}

// One admin per install for now: sign-up creates it (the dashboard's /setup page) and
// then closes, except for the demo login and emails with a pending invitation.
async function guardSignUp(email: string) {
  if (email.toLowerCase() === DEMO_EMAIL || !(await hasAdmin())) return;
  const [invited] = await sql`
    select 1 from auth_invitation
    where lower(email) = lower(${email}) and status = 'pending' and "expiresAt" > now()
    limit 1`;
  if (!invited) throw new APIError("FORBIDDEN", { message: "Sign-up is closed: this install already has its admin account." });
}

// The workspace a new session starts in: the one the user had active most
// recently (sessions are recreated on password change), else their first.
async function initialWorkspace(userId: string): Promise<string | null> {
  const [row] = await sql`
    select m."organizationId" as id
    from auth_member m
    left join auth_session s on s."userId" = m."userId" and s."activeOrganizationId" = m."organizationId"
    where m."userId" = ${userId}
    group by m."organizationId", m."createdAt"
    order by max(s."updatedAt") desc nulls last, m."createdAt"
    limit 1`;
  return row?.id ?? null;
}

// The shared demo account (./demo.ts) is used by many visitors at once, so it can't change
// its profile or credentials, sign others out, or create or manage workspaces and members.
// The dashboard also keeps it out of changes inside the apps.
const DEMO_BLOCKED_PATHS = new Set([
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

const guardDemoAccount = createAuthMiddleware(async (ctx) => {
  if (!DEMO_BLOCKED_PATHS.has(ctx.path)) return;
  const session = await getSessionFromCtx(ctx);
  if (session?.user.email === DEMO_EMAIL) {
    throw new APIError("FORBIDDEN", { message: DEMO_READ_ONLY_MESSAGE });
  }
});

function createDashboardAuth() {
  return betterAuth({
    appName: "Offer SDK",
    secret: secret ?? "offer-sdk-local-dev-secret-0f9c1e7a4b2d8e6f",
    baseURL: appUrl,
    // Locally, the dashboard may run on any port.
    trustedOrigins: isLocalDev ? ["http://localhost:*", "http://127.0.0.1:*"] : [],
    basePath: "/api/auth",
    database: pool,
    emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 8 },
    user: { modelName: "auth_user" },
    session: { modelName: "auth_session" },
    account: { modelName: "auth_account" },
    verification: { modelName: "auth_verification" },
    hooks: { before: guardDemoAccount },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            await guardSignUp(user.email);
          },
          // Sign-up runs in a transaction, so the session above was created before the
          // user row was visible here. Once it commits, join invited workspaces and
          // start the new session in one.
          after: async (user) => {
            await acceptInvitations(user.id);
            await sql`
              update auth_session set "activeOrganizationId" = ${await initialWorkspace(user.id)}
              where "userId" = ${user.id} and "activeOrganizationId" is null`;
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            await acceptInvitations(session.userId);
            return { data: { ...session, activeOrganizationId: await initialWorkspace(session.userId) } };
          },
        },
      },
    },
    plugins: [
      organization({
        schema: {
          organization: { modelName: "auth_organization" },
          member: { modelName: "auth_member" },
          invitation: { modelName: "auth_invitation" },
        },
        // No email provider yet: invitations are recorded and accepted on sign-in (see above).
        sendInvitationEmail: async ({ email, organization: org }) => {
          console.info(`[auth] Invitation to ${org.name} recorded for ${email} (no email sent)`);
        },
        organizationHooks: {
          // The dashboard deletes each app before the workspace; this drops the
          // workspace's org record and any apps it still lists.
          afterDeleteOrganization: async ({ organization: org }) => {
            await sql`
              with org as (delete from orgs where id = ${org.id} returning data)
              delete from apps
              where id in (select jsonb_array_elements_text(coalesce(data -> 'app_ids', '[]')) from org)`;
          },
        },
      }),
    ],
  });
}

// Built on first use: better-auth checks the auth_* tables when it starts, so it
// has to wait for the boot migrations.
let instance: ReturnType<typeof createDashboardAuth> | undefined;

export function handleDashboardAuth(request: Request) {
  return (instance ??= createDashboardAuth()).handler(request);
}

export async function closeDashboardAuth() {
  await pool.end();
}
