"use client";

// Adapted from AI Elements (registry.ai-sdk.dev/prompt-input), trimmed to text input: a form
// with an auto-growing textarea, a footer for tools, and a submit button that turns into
// Stop while a response streams. Enter sends, Shift+Enter adds a line.

import type { ChatStatus } from "ai";
import { ArrowUp, Square } from "lucide-react";
import { useState, type ComponentProps, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Button, Spinner } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PromptInputMessage = { text: string };

export function PromptInput({
  onSubmit,
  className,
  children,
}: {
  onSubmit: (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form
      className={cn(
        "flex w-full flex-col rounded-2xl border border-border-input bg-bg shadow-sm transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--ring)]",
        className,
      )}
      onSubmit={(e) => {
        e.preventDefault();
        const text = String(new FormData(e.currentTarget).get("message") ?? "");
        onSubmit({ text }, e);
      }}
    >
      {children}
    </form>
  );
}

export function PromptInputTextarea({
  className,
  placeholder = "Ask anything…",
  onKeyDown,
  ...props
}: ComponentProps<"textarea">) {
  const [composing, setComposing] = useState(false);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || e.key !== "Enter" || e.shiftKey || composing || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const submit = e.currentTarget.form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!submit?.disabled) e.currentTarget.form?.requestSubmit();
  };

  return (
    <textarea
      name="message"
      rows={1}
      placeholder={placeholder}
      onKeyDown={handleKeyDown}
      onCompositionStart={() => setComposing(true)}
      onCompositionEnd={() => setComposing(false)}
      className={cn(
        "field-sizing-content max-h-48 min-h-[52px] w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm text-fg outline-none scrollbar-thin",
        className,
      )}
      {...props}
    />
  );
}

export function PromptInputFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center justify-between gap-2 px-2.5 pb-2.5", className)} {...props} />;
}

export function PromptInputTools({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex min-w-0 items-center gap-1", className)} {...props} />;
}

export function PromptInputSubmit({
  status,
  onStop,
  disabled,
}: {
  status: ChatStatus;
  /** Called instead of submitting while a response is streaming. */
  onStop?: () => void;
  disabled?: boolean;
}) {
  const busy = status === "submitted" || status === "streaming";
  if (busy && onStop) {
    return (
      <Button icon size="sm" variant="primary" aria-label="Stop" className="rounded-full" onClick={onStop}>
        {status === "submitted" ? <Spinner className="size-4" /> : <Square className="fill-current !size-3" />}
      </Button>
    );
  }
  return (
    <Button type="submit" icon size="sm" variant="primary" aria-label="Send" className="rounded-full" disabled={disabled || busy}>
      <ArrowUp />
    </Button>
  );
}
