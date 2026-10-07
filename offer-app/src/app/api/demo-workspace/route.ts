import { demoEnabled } from "@/server/auth";
import { ensureDemoWorkspace } from "@/server/demo";

export const dynamic = "force-dynamic";

// POST /api/demo-workspace: builds the shared demo workspace if it isn't there yet.
// The sign-in page calls it before signing in to the demo; `pnpm seed:demo` does too.
export async function POST() {
  if (!demoEnabled) return Response.json({ error: "The demo workspace is turned off (DEMO_ENABLED)" }, { status: 404 });
  try {
    await ensureDemoWorkspace();
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[demo]", e);
    return Response.json({ error: "Couldn't set up the demo workspace. The dashboard's logs have the details." }, { status: 502 });
  }
}
