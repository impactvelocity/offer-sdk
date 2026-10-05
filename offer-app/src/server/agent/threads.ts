import type { UIMessage } from "ai";
import { offerApi, OfferApiError } from "@/server/offer-api";
import type { AgentThread, AgentThreadSummary } from "@/lib/agent/types";

// Agent chat threads, stored by the Offer API (or the mock) under
// /apps/:appId/agent/threads. The API trusts the admin key, so ownership is checked here.

const enc = encodeURIComponent;
const path = (appId: string, threadId?: string) =>
  `/apps/${enc(appId)}/agent/threads${threadId ? `/${enc(threadId)}` : ""}`;

export const THREAD_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function listThreads(appId: string, userId: string) {
  return offerApi<AgentThreadSummary[]>("GET", `${path(appId)}?user_id=${enc(userId)}&limit=100`);
}

/** The user's thread, or null when it doesn't exist or belongs to someone else. */
export async function getThread(appId: string, userId: string, threadId: string): Promise<AgentThread | null> {
  if (!THREAD_ID.test(threadId)) return null;
  try {
    const thread = await offerApi<AgentThread>("GET", path(appId, threadId));
    return thread.user_id === userId ? thread : null;
  } catch (e) {
    if (e instanceof OfferApiError && e.status === 404) return null;
    throw e;
  }
}

/** Creates or replaces a thread's messages. Fails with 409 if another user owns the id. */
export function saveThread(appId: string, userId: string, threadId: string, messages: UIMessage[], title?: string) {
  return offerApi<AgentThreadSummary>("PUT", path(appId, threadId), {
    user_id: userId,
    messages,
    ...(title !== undefined && { title }),
  });
}

export async function renameThread(appId: string, userId: string, threadId: string, title: string) {
  if (!(await getThread(appId, userId, threadId))) return null;
  return offerApi<AgentThreadSummary>("PATCH", path(appId, threadId), { title });
}

export async function deleteThread(appId: string, userId: string, threadId: string) {
  if (!(await getThread(appId, userId, threadId))) return false;
  await offerApi("DELETE", path(appId, threadId));
  return true;
}

/** The first user message's text, which titles a new thread. */
export function firstUserText(messages: UIMessage[]) {
  const first = messages.find((m) => m.role === "user");
  return first?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim() ?? "";
}
