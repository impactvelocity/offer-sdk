"use client";

import { Field as BaseField } from "@base-ui/react/field";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label?: ReactNode;
  /** Shown after the label in a lighter tone, e.g. "(optional)". */
  hint?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  name?: string;
  invalid?: boolean;
}

/** Label + control + description/error, wired for accessibility by Base UI's Field. */
export function Field({ label, hint, description, error, children, className, name, invalid }: FieldProps) {
  return (
    <BaseField.Root name={name} invalid={invalid ?? Boolean(error)} className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <BaseField.Label className="text-sm font-medium text-fg-secondary">
          {label}
          {hint ? <span className="ml-1 font-normal text-fg-tertiary">{hint}</span> : null}
        </BaseField.Label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-danger-fg">{error}</p>
      ) : description ? (
        <BaseField.Description className="text-xs text-fg-tertiary">{description}</BaseField.Description>
      ) : null}
    </BaseField.Root>
  );
}

export const FieldControl = BaseField.Control;

export function Label({ children, className, htmlFor }: { children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("text-sm font-medium text-fg-secondary", className)}>
      {children}
    </label>
  );
}
