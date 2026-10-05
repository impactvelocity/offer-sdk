"use client";

import { Ellipsis, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { AgentThreadSummary } from "@/lib/agent/types";
import { cn, formatRelative } from "@/lib/utils";
import { useDeleteThread, useRenameThread, useThreads } from "./use-threads";

const DAY = 86_400_000;

/** Today / Yesterday / Previous 7 days / Previous 30 days / Older, newest first. */
function groupByAge(threads: AgentThreadSummary[]) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const groups: { label: string; threads: AgentThreadSummary[] }[] = [];
  const label = (t: AgentThreadSummary) => {
    const at = new Date(t.updated_at).getTime();
    if (at >= startOfToday) return "Today";
    if (at >= startOfToday - DAY) return "Yesterday";
    if (at >= startOfToday - 7 * DAY) return "Previous 7 days";
    if (at >= startOfToday - 30 * DAY) return "Previous 30 days";
    return "Older";
  };
  for (const t of threads) {
    let group = groups.at(-1);
    if (group?.label !== label(t)) groups.push((group = { label: label(t), threads: [] }));
    group.threads.push(t);
  }
  return groups;
}

export function ThreadList({
  appId,
  activeId,
  onSelect,
  onDeleted,
}: {
  appId: string;
  activeId: string;
  onSelect: (id: string) => void;
  /** Called after a thread is deleted (to leave it if it was open). */
  onDeleted: (id: string) => void;
}) {
  const { data: threads, isLoading, error } = useThreads(appId);
  const remove = useDeleteThread(appId);
  const confirm = useConfirm();
  const [renaming, setRenaming] = useState<AgentThreadSummary | null>(null);

  const onDelete = (thread: AgentThreadSummary) =>
    confirm({
      title: "Delete this chat?",
      description: `“${thread.title || "New chat"}” will be deleted for good. Changes the agent already made stay in place.`,
      confirmLabel: "Delete chat",
      tone: "danger",
      onConfirm: async () => {
        await remove.mutateAsync(thread.id);
        onDeleted(thread.id);
      },
    });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5 p-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
    );
  }
  if (error) return <p className="px-4 py-3 text-sm text-fg-tertiary">Couldn&apos;t load chats.</p>;
  if (!threads?.length) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <MessageSquare className="size-5 text-fg-icon" />
        <p className="text-sm text-fg-tertiary">Your chats will show up here.</p>
      </div>
    );
  }

  return (
    <>
      <nav aria-label="Chats" className="flex flex-col gap-4 p-2">
        {groupByAge(threads).map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <h3 className="px-2.5 pb-1 text-2xs font-medium text-fg-tertiary">{group.label}</h3>
            {group.threads.map((thread) => {
              const active = thread.id === activeId;
              return (
                <div
                  key={thread.id}
                  className={cn(
                    "group/thread relative flex items-center rounded-lg transition-colors hover:bg-bg-hover",
                    active && "bg-accent-subtle hover:bg-accent-subtle",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(thread.id)}
                    aria-current={active ? "page" : undefined}
                    title={`${thread.title || "New chat"} · ${formatRelative(thread.updated_at)}`}
                    className={cn(
                      "flex h-9 min-w-0 flex-1 items-center rounded-lg pl-2.5 pr-9 text-left text-sm text-fg-secondary outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]",
                      active && "font-medium text-accent-fg",
                    )}
                  >
                    <span className="truncate">{thread.title || "New chat"}</span>
                  </button>
                  <Menu>
                    <MenuTrigger
                      aria-label="Chat actions"
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "xs", icon: true }),
                        "absolute right-1 opacity-0 group-hover/thread:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100",
                      )}
                    >
                      <Ellipsis />
                    </MenuTrigger>
                    <MenuContent align="end" className="min-w-40">
                      <MenuItem onClick={() => setRenaming(thread)}>
                        <Pencil />
                        Rename
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem tone="danger" onClick={() => void onDelete(thread)}>
                        <Trash2 />
                        Delete
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent size="sm">
          {renaming ? <RenameForm appId={appId} thread={renaming} onDone={() => setRenaming(null)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RenameForm({ appId, thread, onDone }: { appId: string; thread: AgentThreadSummary; onDone: () => void }) {
  const [title, setTitle] = useState(thread.title);
  const rename = useRenameThread(appId);
  const trimmed = title.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || trimmed === thread.title) return onDone();
    rename.mutate({ id: thread.id, title: trimmed }, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit}>
      <DialogHeader icon={<Pencil />} title="Rename chat" />
      <DialogBody>
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" loading={rename.isPending} disabled={!trimmed}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
