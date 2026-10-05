"use client";

import { Check, Globe, Lock, Plus } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
import type { EndpointAuth, HttpMethod } from "./endpoints";

// Small building blocks shared by the developer pages.

/** Renders `backtick` spans in catalog strings as inline code. */
export function Md({ children }: { children: string }) {
  return (
    <>
      {children.split(/(`[^`]+`)/g).map((part, i) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
          <InlineCode key={i}>{part.slice(1, -1)}</InlineCode>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function InlineCode({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code className={cn("rounded-[4px] bg-bg-muted px-1 py-px text-[0.92em] text-fg", className)}>{children}</code>
  );
}

const methodColors: Record<HttpMethod, BadgeColor> = { GET: "blue", POST: "green", PATCH: "orange", DELETE: "red" };

export function MethodBadge({ method, className }: { method: HttpMethod; className?: string }) {
  return (
    <Badge color={methodColors[method]} className={cn("w-[52px] justify-center font-mono text-[11.5px] tracking-wide", className)}>
      {method}
    </Badge>
  );
}

export function AuthBadge({ auth }: { auth: EndpointAuth }) {
  return auth === "secret" ? (
    <Badge color="gray" icon={<Lock />}>
      Secret key
    </Badge>
  ) : (
    <Badge color="teal" icon={<Globe />}>
      Public or secret
    </Badge>
  );
}

/** A mono path with `:params` highlighted. `dimPrefix` mutes the shared /apps/:appId prefix. */
export function PathText({ path, dimPrefix, className }: { path: string; dimPrefix?: boolean; className?: string }) {
  const prefix = dimPrefix && path.startsWith("/apps/:appId") ? "/apps/:appId" : "";
  return (
    <code className={cn("text-[13.5px] text-fg", className)}>
      {prefix ? <span className="text-fg-placeholder">{prefix}</span> : null}
      {path.slice(prefix.length).split(/(:\w+)/g).map((part, i) =>
        part.startsWith(":") ? (
          <span key={i} className="text-accent-fg">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </code>
  );
}

/** Read-only, copyable value (base URL, app ID). */
export function CopyField({ value, mono = true, className }: { value: string; mono?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-8 min-w-0 items-center gap-1 rounded-md border border-border-input bg-bg-subtle pl-2.5 pr-1 shadow-xs",
        className,
      )}
    >
      <span className={cn("min-w-0 flex-1 truncate text-fg", mono ? "font-mono text-[13.5px]" : "text-sm")}>{value}</span>
      <CopyButton value={value} />
    </div>
  );
}

/** Pill-shaped on/off toggle, used for prompt options. */
export function ToggleChip({
  pressed,
  onPressedChange,
  tone = "accent",
  children,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  tone?: "accent" | "warning";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-sm font-medium transition-colors focus-ring [&_svg]:size-3.5",
        pressed
          ? tone === "warning"
            ? "border-warning/40 bg-warning-subtle text-warning-fg"
            : "border-accent/30 bg-accent-subtle text-accent-fg"
          : "border-border bg-bg text-fg-secondary hover:bg-bg-hover hover:text-fg",
      )}
    >
      {pressed ? <Check /> : <Plus />}
      {children}
    </button>
  );
}
