"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import type { AgentThread, AgentThreadSummary } from "@/lib/agent/types";

// The signed-in user's agent chats for an app (/api/agent/threads).

export const threadKeys = {
  list: (appId: string) => ["agent-threads", appId] as const,
  detail: (appId: string, id: string) => ["agent-threads", appId, id] as const,
};

async function request<T>(method: string, path: string, appId: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/agent/threads${path}?appId=${encodeURIComponent(appId)}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export function useThreads(appId: string) {
  return useQuery({
    queryKey: threadKeys.list(appId),
    queryFn: () => request<AgentThreadSummary[]>("GET", "", appId),
  });
}

/** One thread with its messages. The open chat keeps this cache current, so it never goes stale. */
export function useThread(appId: string, id: string, { enabled = true } = {}) {
  return useQuery({
    queryKey: threadKeys.detail(appId, id),
    queryFn: () => request<AgentThread>("GET", `/${encodeURIComponent(id)}`, appId),
    enabled,
    staleTime: Infinity,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
}

export function useThreadCache(appId: string) {
  const queryClient = useQueryClient();
  return {
    /** Puts a just-started chat at the top of the list before the server confirms it. */
    addOptimistic(id: string, title: string) {
      const now = new Date().toISOString();
      queryClient.setQueryData<AgentThreadSummary[]>(threadKeys.list(appId), (list = []) => [
        { id, app_id: appId, user_id: "", title, message_count: 1, created_at: now, updated_at: now },
        ...list.filter((t) => t.id !== id),
      ]);
    },
    setMessages(id: string, messages: UIMessage[]) {
      queryClient.setQueryData<AgentThread>(threadKeys.detail(appId, id), (thread) => (thread ? { ...thread, messages } : thread));
    },
    refreshList: () => queryClient.invalidateQueries({ queryKey: threadKeys.list(appId), exact: true }),
  };
}

export function useRenameThread(appId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      request<AgentThreadSummary>("PATCH", `/${encodeURIComponent(id)}`, appId, { title }),
    onSuccess: (thread) =>
      queryClient.setQueryData<AgentThreadSummary[]>(threadKeys.list(appId), (list) =>
        list?.map((t) => (t.id === thread.id ? { ...t, title: thread.title } : t)),
      ),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't rename the chat"),
  });
}

export function useDeleteThread(appId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<{ deleted: true }>("DELETE", `/${encodeURIComponent(id)}`, appId),
    onSuccess: (_, id) => {
      queryClient.setQueryData<AgentThreadSummary[]>(threadKeys.list(appId), (list) => list?.filter((t) => t.id !== id));
      queryClient.removeQueries({ queryKey: threadKeys.detail(appId, id) });
      toast.success("Chat deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't delete the chat"),
  });
}
