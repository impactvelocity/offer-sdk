"use client";

import { generateId } from "ai";
import { MessageSquare, MessagesSquare, SquarePen, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { AgentChat, type AgentMessage } from "@/components/agent/agent-chat";
import { ThreadList } from "@/components/agent/thread-list";
import { useThread } from "@/components/agent/use-threads";
import { PageHeader } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { CodeBlock } from "@/components/ui/code-block";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetCloseButton, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp, useAppId } from "@/lib/api/hooks";

/** The open chat. `isNew` chats start empty and are saved when their first message is sent. */
type Active = { id: string; isNew: boolean };

const fresh = (): Active => ({ id: generateId(), isNew: true });

/** Mirrors the open chat in the URL (?thread=) so it survives reloads and can be shared with yourself. */
function setThreadParam(id: string | null, mode: "push" | "replace") {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("thread", id);
  else url.searchParams.delete("thread");
  if (url.href === window.location.href) return;
  window.history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
}

export function AgentView({ enabled, initialThreadId }: { enabled: boolean; initialThreadId: string | null }) {
  const appId = useAppId();
  const { data: app } = useApp(appId);
  const [active, setActive] = useState<Active>(() => (initialThreadId ? { id: initialThreadId, isNew: false } : fresh()));
  const [chatsOpen, setChatsOpen] = useState(false);

  // Back/forward between chats.
  useEffect(() => {
    const onPop = () => {
      const id = new URLSearchParams(window.location.search).get("thread");
      setActive((current) => (id ? (id === current.id ? current : { id, isNew: false }) : current.isNew ? current : fresh()));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const select = (id: string) => {
    setChatsOpen(false);
    if (id === active.id) return;
    setActive({ id, isNew: false });
    setThreadParam(id, "push");
  };

  const newChat = () => {
    setChatsOpen(false);
    setActive(fresh());
    setThreadParam(null, "push");
  };

  const onDeleted = (id: string) => {
    if (id !== active.id) return;
    setActive(fresh());
    setThreadParam(null, "replace");
  };

  const threadList = <ThreadList appId={appId} activeId={active.id} onSelect={select} onDeleted={onDeleted} />;

  return (
    <>
      <PageHeader
        icon={<Sparkles />}
        title="Agent"
        actions={
          <>
            <Button size="sm" className="xl:hidden" onClick={() => setChatsOpen(true)}>
              <MessagesSquare />
              Chats
            </Button>
            <Button size="sm" onClick={newChat}>
              <SquarePen />
              New Chat
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        <aside aria-label="Chat history" className="hidden w-60 shrink-0 flex-col border-r border-border xl:flex">
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{threadList}</div>
        </aside>

        {!enabled ? (
          <div className="mx-auto w-full max-w-[640px] px-6 py-10">
            <Callout tone="warning" title="The agent needs an Anthropic API key">
              Add it to <code>offer-app/.env.local</code> and restart the dev server.
            </Callout>
            <CodeBlock code="ANTHROPIC_API_KEY=sk-ant-..." lang="env" className="mt-4" />
          </div>
        ) : (
          <ChatPane
            appId={appId}
            appName={app?.name}
            active={active}
            onFirstMessage={() => setThreadParam(active.id, "replace")}
            onNewChat={newChat}
          />
        )}
      </div>

      <Sheet open={chatsOpen} onOpenChange={setChatsOpen}>
        <SheetContent className="max-w-[340px]">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
            <MessageSquare className="size-4 text-fg-icon" />
            <SheetTitle className="flex-1 text-base font-semibold text-fg">Chats</SheetTitle>
            <SheetCloseButton />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{threadList}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ChatPane({
  appId,
  appName,
  active,
  onFirstMessage,
  onNewChat,
}: {
  appId: string;
  appName?: string;
  active: Active;
  onFirstMessage: () => void;
  onNewChat: () => void;
}) {
  const thread = useThread(appId, active.id, { enabled: !active.isNew });

  if (active.isNew) {
    return (
      <AgentChat
        key={active.id}
        appId={appId}
        appName={appName}
        threadId={active.id}
        initialMessages={[]}
        enabled
        onFirstMessage={onFirstMessage}
      />
    );
  }
  if (thread.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-6 px-6 py-8">
        <Skeleton className="ml-auto h-10 w-2/5 rounded-2xl" />
        <Skeleton className="h-24 w-4/5" />
        <Skeleton className="ml-auto h-10 w-1/3 rounded-2xl" />
        <Skeleton className="h-16 w-3/5" />
      </div>
    );
  }
  if (thread.error) {
    return (
      <EmptyState
        className="flex-1"
        icon={<MessageSquare />}
        title="Chat not found"
        description="It may have been deleted, or it belongs to someone else."
        action={
          <Button variant="primary" onClick={onNewChat}>
            <SquarePen />
            New Chat
          </Button>
        }
      />
    );
  }
  return (
    <AgentChat
      key={active.id}
      appId={appId}
      appName={appName}
      threadId={active.id}
      initialMessages={thread.data.messages as AgentMessage[]}
      enabled
    />
  );
}
