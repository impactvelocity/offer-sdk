"use client";

import { Switch } from "@base-ui/react/switch";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Shared parts of the demo playgrounds: the control panels down the left and the browser
 * window the mock app sits in.
 */

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-panel p-3">
      <h2 className="px-1 pb-2 text-xs font-medium text-fg-tertiary">{title}</h2>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

export function Control({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-icon"
    >
      {icon}
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid gap-1 rounded-lg bg-canvas p-1 ring-1 ring-border"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-8 rounded-md text-sm text-fg-tertiary transition-colors hover:text-fg",
            value === o.value && "bg-bg-active text-fg shadow-xs",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SwitchRow({
  label,
  checked,
  onChange,
  note,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
  note?: ReactNode;
}) {
  return (
    <label className="flex h-9 items-center gap-2 px-1 text-sm text-fg-secondary">
      <span className="flex-1">{label}</span>
      {note}
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-bg-active p-0.5 ring-1 ring-border-strong ring-inset transition-colors focus-ring data-checked:bg-accent"
      >
        <Switch.Thumb className="size-4 rounded-full bg-white shadow-xs transition-transform data-checked:translate-x-4" />
      </Switch.Root>
    </label>
  );
}

/** A selectable card: who the customer or visitor is. */
export function ChoiceCard({
  selected,
  onClick,
  title,
  note,
  avatar,
}: {
  selected: boolean;
  onClick: () => void;
  title: ReactNode;
  note: ReactNode;
  avatar: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left ring-1 ring-transparent transition-colors ring-inset hover:bg-bg-hover",
        selected && "bg-bg-active ring-border-strong hover:bg-bg-active",
      )}
    >
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-bg-muted text-2xs font-medium text-fg-secondary [&_svg]:size-3.5">
        {avatar}
      </span>
      <span className="min-w-0">
        <span className={cn("block text-sm", selected ? "text-fg" : "text-fg-secondary")}>{title}</span>
        <span className="block text-2xs text-fg-muted">{note}</span>
      </span>
    </button>
  );
}

/** Browser chrome around a mock app. `className` sizes the window. */
export function AppWindow({ url, className, children }: { url: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("relative isolate flex flex-col overflow-hidden rounded-xl border border-border-strong bg-bg shadow-lg", className)}>
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-panel px-3 text-xs text-fg-tertiary">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-bg-active" />
          <span className="size-2.5 rounded-full bg-bg-active" />
          <span className="size-2.5 rounded-full bg-bg-active" />
        </span>
        <span className="mx-auto flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-md bg-bg px-3 font-mono text-[11px]">
          <Lock className="size-3 shrink-0 text-fg-icon" />
          <span className="truncate">{url}</span>
        </span>
      </div>
      {children}
    </div>
  );
}
