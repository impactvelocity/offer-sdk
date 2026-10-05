"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Click-to-edit value, as in Attio's attribute panel. Enter (or blur) saves, Escape cancels.
 * `multiline` uses a textarea where Enter saves and Shift+Enter adds a line.
 */
export function InlineEdit({
  value,
  onSave,
  placeholder = "Empty",
  multiline,
  className,
  required,
  type = "text",
  disabled,
}: {
  value: string | null | undefined;
  onSave: (value: string) => unknown;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  required?: boolean;
  type?: "text" | "number";
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (required && !next) return setDraft(value ?? "");
    if (next !== (value ?? "")) onSave(next);
  };

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  const field =
    "w-full rounded-md border border-accent bg-bg px-2 text-sm text-fg shadow-[0_0_0_3px_var(--ring)] outline-none";

  if (editing) {
    return multiline ? (
      <textarea
        ref={ref}
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancel();
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
        }}
        className={cn(field, "resize-none py-1 leading-5", className)}
      />
    ) : (
      <input
        ref={ref}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancel();
          if (e.key === "Enter") commit();
        }}
        className={cn(field, "h-8", className)}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        setDraft(value ?? "");
        setEditing(true);
      }}
      className={cn(
        "-mx-2 block min-h-8 w-[calc(100%+16px)] rounded-md px-2 py-1 text-left text-sm outline-none transition-colors hover:bg-bg-hover focus-visible:shadow-[0_0_0_2px_var(--ring)] disabled:pointer-events-none",
        multiline ? "whitespace-pre-wrap leading-5" : "truncate",
        value ? "text-fg" : "text-fg-placeholder",
        className,
      )}
    >
      {value || placeholder}
    </button>
  );
}
