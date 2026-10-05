import type { NextRequest } from "next/server";
import { z } from "zod";
import { agentAccess, agentError } from "@/server/agent/access";
import { deleteThread, getThread, renameThread } from "@/server/agent/threads";
import { OfferApiError } from "@/server/offer-api";

export const dynamic = "force-dynamic";

// One of the signed-in user's chats (?appId= required). Other users' threads are 404s.
//   GET     the thread with its messages
//   PATCH   { title }
//   DELETE

type Ctx = RouteContext<"/api/agent/threads/[threadId]">;

async function run(req: NextRequest, ctx: Ctx, fn: (appId: string, userId: string, threadId: string) => Promise<Response>) {
  const access = await agentAccess(req.nextUrl.searchParams.get("appId"));
  if (access instanceof Response) return access;
  try {
    return await fn(access.appId, access.userId, (await ctx.params).threadId);
  } catch (e) {
    if (e instanceof OfferApiError) return agentError(e.status, e.message);
    throw e;
  }
}

const notFound = () => agentError(404, "Chat not found");

export function GET(req: NextRequest, ctx: Ctx) {
  return run(req, ctx, async (appId, userId, threadId) => {
    const thread = await getThread(appId, userId, threadId);
    return thread ? Response.json(thread) : notFound();
  });
}

const renameBody = z.object({ title: z.string().trim().min(1).max(120) });

export function PATCH(req: NextRequest, ctx: Ctx) {
  return run(req, ctx, async (appId, userId, threadId) => {
    const parsed = renameBody.safeParse(await req.json().catch(() => undefined));
    if (!parsed.success) return agentError(400, "Title is required (up to 120 characters)");
    const thread = await renameThread(appId, userId, threadId, parsed.data.title);
    return thread ? Response.json(thread) : notFound();
  });
}

export function DELETE(req: NextRequest, ctx: Ctx) {
  return run(req, ctx, async (appId, userId, threadId) =>
    (await deleteThread(appId, userId, threadId)) ? Response.json({ deleted: true }) : notFound(),
  );
}
