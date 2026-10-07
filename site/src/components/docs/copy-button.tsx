"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true), () => {})}
      aria-label={copied ? "Copied" : "Copy code"}
      className={cn(
        "focus-ring flex size-7 items-center justify-center rounded-md text-fg-icon transition-colors hover:bg-bg-hover hover:text-fg [&_svg]:size-3.5",
        className,
      )}
    >
      {copied ? <Check className="text-accent-fg" /> : <Copy />}
    </button>
  );
}
