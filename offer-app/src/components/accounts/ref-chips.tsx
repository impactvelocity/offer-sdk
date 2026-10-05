"use client";

import { Gift, Layers, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Chip } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const kinds = {
  plan: { icon: <Layers />, path: "plans", noun: "plan" },
  incentive: { icon: <Gift />, path: "incentives", noun: "incentive" },
};

/**
 * Link to the plan or incentive an account references. Shows the raw id with a warning
 * when the record no longer exists (the API doesn't cascade deletes).
 */
export function RefChip({
  kind,
  appId,
  id,
  name,
  loading,
  className,
}: {
  kind: keyof typeof kinds;
  appId: string;
  id: string;
  /** Display name, or undefined when the record wasn't found. */
  name: string | undefined;
  loading?: boolean;
  className?: string;
}) {
  const { icon, path, noun } = kinds[kind];
  if (loading && !name) return <Skeleton className="h-[22px] w-20" />;
  if (!name) {
    return (
      <Tooltip content={`This ${noun} no longer exists`}>
        <span className={cn("inline-flex max-w-full", className)}>
          <Chip icon={<TriangleAlert className="!text-warning" />} className="text-fg-secondary">
            <code className="text-xs">{id}</code>
          </Chip>
        </span>
      </Tooltip>
    );
  }
  return (
    <Link
      href={`/apps/${appId}/${path}/${encodeURIComponent(id)}`}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "group/chip inline-flex max-w-full rounded-md outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]",
        className,
      )}
    >
      <Chip icon={icon} className="transition-colors group-hover/chip:border-border-strong group-hover/chip:bg-bg-hover">
        {name}
      </Chip>
    </Link>
  );
}
