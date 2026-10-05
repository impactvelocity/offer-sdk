"use client";

// Adapted from AI Elements (registry.ai-sdk.dev/suggestion) onto the app's Button.

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Suggestions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center justify-center gap-2", className)}>{children}</div>;
}

export function Suggestion({
  suggestion,
  onClick,
  icon,
  className,
}: {
  suggestion: string;
  onClick?: (suggestion: string) => void;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Button size="sm" className={cn("rounded-full px-3.5 text-fg-secondary", className)} onClick={() => onClick?.(suggestion)}>
      {icon}
      {suggestion}
    </Button>
  );
}
