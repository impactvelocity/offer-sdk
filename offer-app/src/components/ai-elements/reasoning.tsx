"use client";

// Adapted from AI Elements (registry.ai-sdk.dev/reasoning) onto Base UI's Collapsible.
// Opens while the model is thinking, then folds away once it starts answering.

import { Collapsible } from "@base-ui/react/collapsible";
import { Brain, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import { Shimmer } from "./shimmer";

const AUTO_CLOSE_DELAY = 800;

export function Reasoning({ text, isStreaming, className }: { text: string; isStreaming: boolean; className?: string }) {
  const [open, setOpen] = useState(isStreaming);
  const [startedAt] = useState(() => (isStreaming ? Date.now() : null));
  const [duration, setDuration] = useState<number | null>(null);

  // Once thinking ends, record how long it took and fold the panel away.
  useEffect(() => {
    if (isStreaming || startedAt === null) return;
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const record = setTimeout(() => setDuration(seconds), 0);
    const close = setTimeout(() => setOpen(false), AUTO_CLOSE_DELAY);
    return () => {
      clearTimeout(record);
      clearTimeout(close);
    };
  }, [isStreaming, startedAt]);

  const label = isStreaming
    ? null
    : duration !== null
      ? `Thought for ${duration} second${duration === 1 ? "" : "s"}`
      : "Thought for a few seconds";

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className={cn("w-full", className)}>
      <Collapsible.Trigger className="group/reasoning flex items-center gap-1.5 rounded-md text-sm text-fg-tertiary outline-none transition-colors hover:text-fg focus-visible:shadow-[0_0_0_2px_var(--ring)] [&_svg]:size-4 [&_svg]:text-fg-icon">
        <Brain />
        {label ?? <Shimmer>Thinking…</Shimmer>}
        <ChevronDown className="transition-transform group-data-panel-open/reasoning:rotate-180" />
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
        {text ? (
          <div className="mt-2.5 border-l-2 border-border-strong pl-3.5 text-[13px] leading-[1.6] text-fg-tertiary [&_p]:my-1.5">
            <Streamdown isAnimating={isStreaming}>{text}</Streamdown>
          </div>
        ) : null}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
