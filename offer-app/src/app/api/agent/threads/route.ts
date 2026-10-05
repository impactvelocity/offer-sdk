import type { NextRequest } from "next/server";
import { agentAccess, agentError } from "@/server/agent/access";
import { listThreads } from "@/server/agent/threads";
import { OfferApiError } from "@/server/offer-api";

export const dynamic = "force-dynamic";

// GET /api/agent/threads?appId=  The signed-in user's chats for an app, newest first.
export async function GET(req: NextRequest) {
  const access = await agentAccess(req.nextUrl.searchParams.get("appId"));
  if (access instanceof Response) return access;
  try {
    return Response.json(await listThreads(access.appId, access.userId));
  } catch (e) {
    if (e instanceof OfferApiError) return agentError(e.status, e.message);
    throw e;
  }
}
