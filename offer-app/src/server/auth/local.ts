import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { memoryAdapter, type MemoryDB } from "better-auth/adapters/memory";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { env } from "@/server/env";
import { seedDemoOrg } from "@/server/offer-api";
import { DEMO_USER } from "@/server/offer-api/sample-data";

// Mock mode only (no OFFER_API_URL): better-auth runs in this process with an in-memory
// store, so sessions and users reset when the server restarts. With the hosted API,
// auth lives there instead (see ./remote.ts).

const globalForAuth = globalThis as unknown as { __offerAuthDb?: MemoryDB };
const memory: MemoryDB = (globalForAuth.__offerAuthDb ??= {
  user: [],
  session: [],
  account: [],
  verification: [],
  organization: [],
  member: [],
  invitation: [],
});

export { DEMO_USER };

/** Whether this install has its admin: any account besides the shared demo login. */
export const localHasAdmin = () => memory.user.some((u) => u.email.toLowerCase() !== DEMO_USER.email);

// One admin per install for now, as in the hosted API (api/src/lib/dashboard-auth.ts):
// sign-up creates it, then only the demo login and invited emails can sign up.
function guardSignUp(email: string) {
  if (email.toLowerCase() === DEMO_USER.email || !localHasAdmin()) return;
  const invited = memory.invitation.some(
    (i) => i.email?.toLowerCase() === email.toLowerCase() && i.status === "pending" && new Date(i.expiresAt) > new Date(),
  );
  if (!invited) throw new APIError("FORBIDDEN", { message: "Sign-up is closed: this install already has its admin account." });
}

function createLocalAuth() {
  return betterAuth({
    appName: "Offer SDK",
    secret: env.BETTER_AUTH_SECRET ?? "offer-sdk-local-dev-secret-0f9c1e7a4b2d8e6f",
    baseURL: env.BETTER_AUTH_URL,
    database: memoryAdapter(memory),
    emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 8 },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            guardSignUp(user.email);
          },
          // Mock invitations: accept any pending invite for this email as soon as the user signs up.
          after: async (user) => {
            for (const invite of memory.invitation) {
              if (invite.email?.toLowerCase() !== user.email.toLowerCase() || invite.status !== "pending") continue;
              invite.status = "accepted";
              memory.member.push({
                id: crypto.randomUUID(),
                organizationId: invite.organizationId,
                userId: user.id,
                role: invite.role ?? "member",
                createdAt: new Date(),
              });
            }
          },
        },
      },
      session: {
        create: {
          // Start new sessions in the workspace the user last had active (sessions are recreated
          // on password change), falling back to their first workspace.
          before: async (session) => {
            const memberOf = new Set(memory.member.filter((m) => m.userId === session.userId).map((m) => m.organizationId));
            const previous = memory.session
              .filter((s) => s.userId === session.userId && s.activeOrganizationId && memberOf.has(s.activeOrganizationId))
              .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())[0];
            const activeOrganizationId = previous?.activeOrganizationId ?? [...memberOf][0] ?? null;
            return { data: { ...session, activeOrganizationId } };
          },
        },
      },
    },
    plugins: [
      organization({
        // No email provider yet: invitations are recorded and accepted on sign-up (see above).
        sendInvitationEmail: async ({ email, organization: org }) => {
          console.info(`[auth] Invitation to ${org.name} recorded for ${email} (no email sent in mock mode)`);
        },
      }),
      nextCookies(),
    ],
  });
}

let instance: ReturnType<typeof createLocalAuth> | undefined;

/** Built on first use, so remote mode never creates it. */
export const localAuth = () => (instance ??= createLocalAuth());

let demoReady: Promise<void> | undefined;

/** Creates the demo user, workspace and sample apps once per process. */
export function ensureDemoData() {
  return (demoReady ??= (async () => {
    if (memory.user.some((u) => u.email === DEMO_USER.email)) return;
    const auth = localAuth();
    const { headers: resHeaders } = await auth.api.signUpEmail({
      body: { name: DEMO_USER.name, email: DEMO_USER.email, password: DEMO_USER.password },
      returnHeaders: true,
    });
    const cookie = resHeaders.get("set-cookie")?.split(";")[0] ?? "";
    const org = await auth.api.createOrganization({
      body: { name: DEMO_USER.workspace, slug: "acme-labs" },
      headers: new Headers({ cookie }),
    });
    if (org) await seedDemoOrg(org.id);
  })().catch((err) => {
    demoReady = undefined;
    throw err;
  }));
}
