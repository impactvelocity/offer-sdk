import { timingSafeEqual } from "node:crypto";
import { demoEnabled } from "@/server/auth";
import { ensureDemoWorkspace, resetDemoWorkspace } from "@/server/demo";
import { env } from "@/server/env";
import { offerApiMode } from "@/server/offer-api";

export const dynamic = "force-dynamic";

// POST /api/demo-workspace: builds the shared demo workspace if it isn't there yet.
// The sign-in page calls it before signing in to the demo; `pnpm seed:demo` does too.
// With { "reset": true } and the admin key as a bearer token (`pnpm seed:demo --reset`),
// it deletes the demo apps and builds them again.

function isAdmin(req: Request) {
  const key = env.OFFER_API_ADMIN_KEY;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return !!key && given.length === key.length && timingSafeEqual(Buffer.from(given), Buffer.from(key));
}

export async function POST(req: Request) {
  if (!demoEnabled) return Response.json({ error: "The demo workspace is turned off (DEMO_ENABLED)" }, { status: 404 });
  const reset = ((await req.json().catch(() => null)) as { reset?: unknown } | null)?.reset === true;
  if (reset && !isAdmin(req)) return Response.json({ error: "Resetting the demo needs the admin key (the API's ADMIN_API_KEY)" }, { status: 401 });
  if (reset && offerApiMode === "mock") {
    return Response.json({ error: "This dashboard runs on the in-memory mock. Restart it to reset the demo." }, { status: 400 });
  }
  try {
    await (reset ? resetDemoWorkspace() : ensureDemoWorkspace());
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[demo]", e);
    return Response.json({ error: "Couldn't set up the demo workspace. The dashboard's logs have the details." }, { status: 502 });
  }
}
