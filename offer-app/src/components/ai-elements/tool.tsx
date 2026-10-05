"use client";

// Adapted from AI Elements (registry.ai-sdk.dev/tool) onto Base UI's Collapsible and the
// app's Badge/CodeBlock: a compact row per tool call that expands to its input and output.

import { Collapsible } from "@base-ui/react/collapsible";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { ChevronRight, CircleCheck, CircleX, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";

type ToolState = (ToolUIPart | DynamicToolUIPart)["state"];

const statusIcon = (state: ToolState): ReactNode => {
  switch (state) {
    case "output-available":
      return <CircleCheck className="text-success" />;
    case "output-error":
    case "output-denied":
      return <CircleX className="text-danger" />;
    default:
      return <Spinner className="size-4 text-fg-icon" />;
  }
};

export function Tool({ children, className, defaultOpen }: { children: ReactNode; className?: string; defaultOpen?: boolean }) {
  return (
    <Collapsible.Root
      defaultOpen={defaultOpen}
      className={cn("w-full overflow-hidden rounded-lg border border-border bg-bg", className)}
    >
      {children}
    </Collapsible.Root>
  );
}

export function ToolHeader({ title, state }: { title: ReactNode; state: ToolState }) {
  return (
    <Collapsible.Trigger className="flex h-10 w-full items-center gap-2.5 px-3 text-left text-sm outline-none transition-colors hover:bg-bg-hover focus-visible:bg-bg-hover [&_svg]:size-4 [&_svg]:shrink-0">
      <Wrench className="text-fg-icon" />
      <span className="min-w-0 flex-1 truncate font-medium text-fg-secondary">{title}</span>
      {statusIcon(state)}
      <ChevronRight className="text-fg-icon transition-transform [[data-panel-open]>&]:rotate-90" />
    </Collapsible.Trigger>
  );
}

export function ToolContent({ children }: { children: ReactNode }) {
  return (
    <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
      <div className="flex flex-col gap-3 border-t border-border bg-bg-subtle p-3">{children}</div>
    </Collapsible.Panel>
  );
}

/** Several tool calls from one step, folded into a single "Used N tools" row. */
export function ToolGroup({ count, states, children }: { count: number; states: ToolState[]; children: ReactNode }) {
  const running = states.some((s) => s === "input-streaming" || s === "input-available");
  const failed = states.some((s) => s === "output-error" || s === "output-denied");
  return (
    <Tool>
      <ToolHeader title={`Used ${count} tools`} state={running ? "input-available" : failed ? "output-error" : "output-available"} />
      <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
        <div className="flex flex-col gap-1.5 border-t border-border bg-bg-subtle p-2">{children}</div>
      </Collapsible.Panel>
    </Tool>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-2xs font-medium uppercase tracking-wide text-fg-tertiary">{label}</h4>
      {children}
    </div>
  );
}

export function ToolInput({ input }: { input: unknown }) {
  if (input === undefined || (typeof input === "object" && input !== null && Object.keys(input).length === 0)) return null;
  return (
    <Section label="Parameters">
      <CodeBlock code={JSON.stringify(input, null, 2)} lang="json" className="bg-bg" maxHeight={200} />
    </Section>
  );
}

export function ToolOutput({ output, errorText }: { output: unknown; errorText?: string }) {
  if (errorText) {
    return (
      <Section label="Error">
        <div className="rounded-lg border border-danger/25 bg-danger-subtle px-3 py-2 text-xs text-danger-fg">{errorText}</div>
      </Section>
    );
  }
  if (output === undefined) return null;
  return (
    <Section label="Result">
      <CodeBlock
        code={typeof output === "string" ? output : JSON.stringify(output, null, 2)}
        lang="json"
        className="bg-bg"
        maxHeight={280}
      />
    </Section>
  );
}
