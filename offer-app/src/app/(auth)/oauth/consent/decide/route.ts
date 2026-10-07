import type { NextRequest } from "next/server";
import { getSession } from "@/server/auth";
import { consentApps, getConsentRequest, isAccessLevel } from "@/server/mcp-consent";
import { offerApi, OfferApiError } from "@/server/offer-api";

export const dynamic = "force-dynamic";

// POST /oauth/consent/decide  (form: request, decision=approve|deny, access_level, app_id?)
// Approves or denies an MCP client's authorization request, then sends the browser back to
// the client's redirect URI. A route handler rather than a server action so the 303 can
// point at app schemes like cursor://.

const back = (req: NextRequest, id: string, error?: string) => {
  const url = new URL("/oauth/consent", req.url);
  url.searchParams.set("request", id);
  if (error) url.searchParams.set("error", error);
  return new Response(null, { status: 303, headers: { Location: `${url.pathname}${url.search}` } });
};

// Consent forms only count from this site (SameSite cookies cover most of it; this covers the rest).
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return Response.json({ error: "Cross-site request refused" }, { status: 403 });
  const form = await req.formData();
  const id = String(form.get("request") ?? "");
  if (!id) return Response.json({ error: "Missing request" }, { status: 400 });

  const session = await getSession();
  if (!session) {
    const next = `/oauth/consent?request=${encodeURIComponent(id)}`;
    return new Response(null, { status: 303, headers: { Location: `/sign-in?next=${encodeURIComponent(next)}` } });
  }

  try {
    if (form.get("decision") === "deny") {
      const { redirect_url } = await offerApi<{ redirect_url: string }>("POST", `/oauth/requests/${encodeURIComponent(id)}/deny`);
      return new Response(null, { status: 303, headers: { Location: redirect_url } });
    }

    const level = form.get("access_level");
    if (!isAccessLevel(level)) return back(req, id, "Pick an access level.");
    const request = await getConsentRequest(id);
    const appId = request.app_id ?? String(form.get("app_id") ?? "");
    if (!appId) return back(req, id, "Pick an app to connect.");
    // Only apps in the person's own workspaces.
    if (!(await consentApps()).some((a) => a.id === appId)) {
      return back(req, id, "You don't have access to that app. Ask a workspace admin to invite you.");
    }

    const { redirect_url } = await offerApi<{ redirect_url: string }>("POST", `/oauth/requests/${encodeURIComponent(id)}/approve`, {
      user: { id: session.user.id, name: session.user.name, email: session.user.email },
      access_level: level,
      app_id: appId,
    });
    return new Response(null, { status: 303, headers: { Location: redirect_url } });
  } catch (e) {
    if (e instanceof OfferApiError) return back(req, id, e.message);
    console.error("[oauth consent]", e);
    return back(req, id, "Couldn't reach the Offer API. Try again.");
  }
}
