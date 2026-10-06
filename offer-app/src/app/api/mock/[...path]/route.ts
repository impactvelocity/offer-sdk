import type { NextRequest } from "next/server";
import { offerApiMode } from "@/server/offer-api";
import { handleMockRequest } from "@/server/offer-api/mock/routes";
import { ensureDemoData } from "@/server/auth";

export const dynamic = "force-dynamic";

// The in-memory mock exposed with the hosted API's paths and key rules, so tenant code,
// curl and the API reference's "Try it" can call it with an app's secret or public key.
async function handle(req: NextRequest, ctx: RouteContext<"/api/mock/[...path]">) {
  if (offerApiMode !== "mock") {
    return Response.json({ error: "The mock API is disabled because OFFER_API_URL is set." }, { status: 404 });
  }
  await ensureDemoData();
  const { path } = await ctx.params;
  const auth = req.headers.get("authorization");
  const text = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return handleMockRequest({
    method: req.method,
    path: `/${path.map(encodeURIComponent).join("/")}`,
    query: req.nextUrl.searchParams,
    body,
    apiKey: auth?.startsWith("Bearer ") ? auth.slice(7) : null,
  });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
