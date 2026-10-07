// Builds the shared demo workspace on a dashboard ahead of time, or rebuilds it: the demo
// login, its "Acme Labs" workspace and two sample apps (a SaaS and an online course) with
// their catalogs, ~6 months of accounts and usage history, saved reports, an offer and a
// cancel flow. The dashboard builds it on its own the first time someone clicks "Explore
// the demo workspace" (DEMO_ENABLED=true), so this is for warming it up and for --reset.
//
//   pnpm seed:demo                                          # local dashboard (http://localhost:6768)
//   APP_URL=https://offer-app.onrender.com pnpm seed:demo   # a deployed dashboard
//   pnpm seed:demo --reset                                  # rebuild the apps, undoing visitors' changes
//
// It goes through the dashboard like a browser (POST /api/demo-workspace; --reset signs in
// and deletes the apps through the /api/admin BFF first), so it only needs the dashboard's URL.

import { DEMO_USER } from "../src/server/offer-api/sample-data.ts";

const APP_URL = (process.env.APP_URL ?? "http://localhost:6768").replace(/\/+$/, "");
const RESET = process.argv.includes("--reset");

const cookies = new Map<string, string>();

async function call<T = unknown>(method: string, path: string, body?: unknown, ok: number[] = []): Promise<{ status: number; data: T }> {
  let res: Response;
  try {
    res = await fetch(`${APP_URL}${path}`, {
      method,
      headers: {
        origin: APP_URL,
        cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(body !== undefined && { "content-type": "application/json" }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Can't reach the dashboard at ${APP_URL}. Is it running? (Set APP_URL for a deployed one.)`);
  }
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    cookies.set(pair.slice(0, i), pair.slice(i + 1));
  }
  const data = await res.json().catch(() => null);
  if (!res.ok && !ok.includes(res.status)) {
    const message = (data as { error?: string; message?: string } | null)?.error ?? (data as { message?: string } | null)?.message;
    throw new Error(`${method} ${path} → ${res.status}: ${message ?? JSON.stringify(data)}`);
  }
  return { status: res.status, data: data as T };
}

const { email, password } = DEMO_USER;

// --reset: delete the demo apps (if the demo exists yet); the dashboard then builds them again.
if (RESET) {
  const signIn = await call("POST", "/api/auth/sign-in/email", { email, password }, [401]);
  if (signIn.status === 200) {
    const { mode } = (await call<{ mode: string }>("GET", "/api/admin/workspace")).data;
    if (mode === "mock") throw new Error("This dashboard runs on the in-memory mock (OFFER_API_URL=mock). Restart it to reset the demo.");
    for (const app of (await call<{ id: string; name: string }[]>("GET", "/api/admin/workspace/apps")).data) {
      await call("DELETE", `/api/admin/apps/${app.id}`);
      console.log(`Deleted ${app.name}`);
    }
  }
}

const ready = await call("POST", "/api/demo-workspace", undefined, [404]);
if (ready.status === 404) throw new Error("This dashboard has the demo turned off. Set DEMO_ENABLED=true on it.");

console.log(`
Demo workspace ready at ${APP_URL}
  Email:    ${email}
  Password: ${password}`);
