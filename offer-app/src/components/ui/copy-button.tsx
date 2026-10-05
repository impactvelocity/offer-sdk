"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "./tooltip";

export function useCopy(timeout = 1500) {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), timeout);
  };
  return { copied, copy };
}

export function CopyButton({ value, className, label = "Copy" }: { value: string; className?: string; label?: string }) {
  const { copied, copy } = useCopy();
  return (
    <Tooltip content={copied ? "Copied" : label}>
      <button
        type="button"
        aria-label={label}
        onClick={() => copy(value)}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md text-fg-icon outline-none transition-colors hover:bg-bg-hover hover:text-fg focus-visible:shadow-[0_0_0_2px_var(--ring)] [&_svg]:size-3.5",
          className,
        )}
      >
        {copied ? <Check className="text-success" /> : <Copy />}
      </button>
    </Tooltip>
  );
}
