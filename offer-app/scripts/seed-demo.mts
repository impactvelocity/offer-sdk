// Builds the shared demo workspace on a dashboard ahead of time, or rebuilds it: the demo
// login, its "Acme Labs" workspace and two sample apps (a SaaS and an online course) with
// their catalogs, ~6 months of accounts and usage history, saved reports, an offer and a
// cancel flow. The dashboard builds it on its own the first time someone clicks "Explore
// the demo workspace" (DEMO_ENABLED=true), so this is for warming it up and for --reset.
//
//   pnpm seed:demo                                          # local dashboard (http://localhost:6768)
//   APP_URL=https://offer-app.onrender.com pnpm seed:demo   # a deployed dashboard
//   pnpm seed:demo --reset                                  # rebuild the apps from scratch
//   APP_URL=https://… ADMIN_API_KEY=… pnpm seed:demo --reset   # the same on a deployed dashboard
//
// It calls the dashboard's POST /api/demo-workspace, so it only needs the dashboard's URL
// (plus the admin key for --reset, since the demo login is read-only).

import { DEMO_USER } from "../src/server/offer-api/sample-data.ts";

const APP_URL = (process.env.APP_URL ?? "http://localhost:6768").replace(/\/+$/, "");
const RESET = process.argv.includes("--reset");
// --reset only: the API's ADMIN_API_KEY (the dashboard's OFFER_API_ADMIN_KEY). Local default: dev-admin-key.
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? (/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(`${APP_URL}/`) ? "dev-admin-key" : undefined);
if (RESET && !ADMIN_KEY) throw new Error("--reset needs ADMIN_API_KEY (the API's admin key, from Render) for a deployed dashboard.");

const cookies = new Map<string, string>();

async function call<T = unknown>(method: string, path: string, body?: unknown, ok: number[] = []): Promise<{ status: number; data: T }> {
  let res: Response;
  try {
    res = await fetch(`${APP_URL}${path}`, {
      method,
      headers: {
        origin: APP_URL,
        cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(RESET && { authorization: `Bearer ${ADMIN_KEY}` }),
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

// --reset: the dashboard deletes the demo apps with the admin key and builds them again
// (the demo login itself is read-only).
const ready = await call("POST", "/api/demo-workspace", RESET ? { reset: true } : undefined, [404]);
if (RESET) console.log("Rebuilt the demo apps");
if (ready.status === 404) throw new Error("This dashboard has the demo turned off. Set DEMO_ENABLED=true on it.");

console.log(`
Demo workspace ready at ${APP_URL}
  Email:    ${email}
  Password: ${password}`);
