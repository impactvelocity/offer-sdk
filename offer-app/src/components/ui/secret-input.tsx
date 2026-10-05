"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";
import { Tooltip } from "./tooltip";

/** Read-only key display with reveal and copy. */
export function SecretInput({ value, masked = true, className }: { value: string; masked?: boolean; className?: string }) {
  const [revealed, setRevealed] = useState(!masked);
  const shown = revealed ? value : `${value.slice(0, 8)}${"•".repeat(Math.max(8, Math.min(24, value.length - 12)))}${value.slice(-4)}`;
  return (
    <div
      className={cn(
        "flex h-9 items-center gap-1 rounded-md border border-border-input bg-bg-subtle pl-3 pr-1 shadow-xs",
        className,
      )}
    >
      <code className="min-w-0 flex-1 truncate text-[13.5px] text-fg">{shown}</code>
      {masked ? (
        <Tooltip content={revealed ? "Hide" : "Reveal"}>
          <button
            type="button"
            aria-label={revealed ? "Hide key" : "Reveal key"}
            onClick={() => setRevealed((r) => !r)}
            className="flex size-7 items-center justify-center rounded-md text-fg-icon hover:bg-bg-hover hover:text-fg [&_svg]:size-3.5"
          >
            {revealed ? <EyeOff /> : <Eye />}
          </button>
        </Tooltip>
      ) : null}
      <CopyButton value={value} label="Copy key" />
    </div>
  );
}
