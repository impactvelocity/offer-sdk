// History import and the shared demo account's guard rails, against a real Postgres.
// Needs DATABASE_URL like api.test.ts.
import { beforeAll, describe, expect, test } from "bun:test";

process.env.ADMIN_API_KEY = "test-admin-key";

const { default: app } = await import("../src/app.ts");
const { default: sql } = await import("../src/db/client.ts");
const { migrate } = await import("../src/db/migrate.ts");

const ADMIN = "test-admin-key";

async function call(method: string, path: string, opts: { key?: string; body?: unknown; cookie?: string } = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${opts.key ?? ADMIN}`,
    Origin: "http://localhost:6768",
  };
  if (opts.cookie) headers.Cookie = opts.cookie;
  const res = await app.request(path, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return { status: res.status, json: (await res.json().catch(() => null)) as any, cookie: cookie || opts.cookie };
}

let appId: string;
let apiKey: string;

beforeAll(async () => {
  await migrate();
  await sql`truncate apps, orgs, usage_events, auth_user, auth_organization, auth_verification cascade`;
  ({ id: appId, api_key: apiKey } = (await call("POST", "/apps", { body: { name: "History" } })).json);
  await call("POST", `/apps/${appId}/entitlements`, { body: { id: "credits", name: "Credits", type: "usage" } });
  await call("POST", `/apps/${appId}/entitlements`, { body: { id: "sso", name: "SSO", type: "boolean" } });
  await call("POST", `/apps/${appId}/plans`, { body: { id: "pro", name: "Pro" } });
  await call("POST", `/apps/${appId}/namespaces`, { body: { id: "acct_1", name: "One", plan: "pro" } });
});

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe("history import", () => {
  const path = () => `/apps/${appId}/import`;

  test("admin key only", async () => {
    expect((await call("POST", path(), { key: apiKey, body: {} })).status).toBe(401);
  });

  test("validates before writing", async () => {
    const event = { namespace_id: "acct_1", entitlement_id: "credits", operation: "amount", amount: 5, created_at: daysAgo(3) };
    expect((await call("POST", path(), { body: { usage_events: [{ ...event, namespace_id: "ghost" }] } })).status).toBe(404);
    expect((await call("POST", path(), { body: { usage_events: [{ ...event, entitlement_id: "sso" }] } })).status).toBe(400);
    expect((await call("POST", path(), { body: { usage_events: [{ ...event, operation: "set" }] } })).status).toBe(400);
    expect((await call("POST", path(), { body: { usage_events: [{ ...event, created_at: daysAgo(-2) }] } })).status).toBe(400);
    expect((await sql`select count(*)::int as n from usage_events`)[0].n).toBe(0);
  });

  test("backdates accounts and records usage in time order", async () => {
    const res = await call("POST", path(), {
      body: {
        namespaces: [{ id: "acct_1", created_at: daysAgo(90) }],
        usage_events: [
          { namespace_id: "acct_1", entitlement_id: "credits", operation: "amount", amount: 10, created_at: daysAgo(10) },
          { namespace_id: "acct_1", entitlement_id: "credits", operation: "amount", amount: 4, created_at: daysAgo(40) },
        ],
      },
    });
    expect(res.json).toEqual({ imported: { namespaces: 1, usage_events: 2 } });

    const account = await call("GET", `/apps/${appId}/namespaces/acct_1`);
    expect(account.json.created_at).toBe(daysAgo(90).slice(0, 10) + account.json.created_at.slice(10));

    // A live event continues from the imported total.
    const live = await call("POST", `/apps/${appId}/namespaces/acct_1/usage/credits/amount`, { body: { amount: 1 } });
    expect(live.json.count).toBe(15);

    const events = await call("GET", `/apps/${appId}/analytics/events?limit=5`);
    expect(events.json.map((e: any) => e.count)).toEqual([15, 14, 4]);
    const series = await call("GET", `/apps/${appId}/analytics/timeseries?interval=60d`);
    expect(series.json.map((r: any) => r.total_amount)).toEqual([4, 10, 1]);
  });
});

describe("demo account", () => {
  const auth = (path: string, body: unknown, cookie?: string) => call("POST", `/api/auth${path}`, { body, cookie });

  test("can't change credentials or manage its workspace", async () => {
    const demo = await auth("/sign-up/email", { name: "Demo", email: "demo@offersdk.dev", password: "demo-password" });
    expect(demo.status).toBe(200);
    const ws = await auth("/organization/create", { name: "Acme Labs", slug: "offer-sdk-demo" }, demo.cookie);
    expect(ws.status).toBe(200);

    expect((await auth("/change-password", { currentPassword: "demo-password", newPassword: "hijacked-123" }, demo.cookie)).status).toBe(403);
    expect((await auth("/update-user", { name: "Mallory" }, demo.cookie)).status).toBe(403);
    expect((await auth("/revoke-other-sessions", {}, demo.cookie)).status).toBe(403);
    expect((await auth("/organization/delete", { organizationId: ws.json.id }, demo.cookie)).status).toBe(403);
    expect((await auth("/organization/invite-member", { email: "x@example.com", role: "member", organizationId: ws.json.id }, demo.cookie)).status).toBe(403);
    // Still signs in with the shared password.
    expect((await auth("/sign-in/email", { email: "demo@offersdk.dev", password: "demo-password" })).status).toBe(200);
  });

  test("other accounts aren't affected", async () => {
    const user = await auth("/sign-up/email", { name: "Real", email: "real@example.com", password: "real-password" });
    expect((await auth("/update-user", { name: "Renamed" }, user.cookie)).status).toBe(200);
  });
});
