"use client";

import { Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { useCommandMenu } from "./command-menu";

export function QuickActionsButton() {
  const { open } = useCommandMenu();
  return (
    <button
      type="button"
      onClick={open}
      className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-bg px-2.5 text-sm text-fg-tertiary shadow-xs outline-none transition-colors hover:text-fg-secondary focus-visible:shadow-[0_0_0_2px_var(--ring)]"
    >
      <Search className="size-4 text-fg-icon" />
      <span className="flex-1 text-left">Quick actions</span>
      <Kbd>⌘K</Kbd>
    </button>
  );
}
