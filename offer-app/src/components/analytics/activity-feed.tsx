import { Minus, Plus, Sigma } from "lucide-react";
import Link from "next/link";
import type { UsageEvent } from "@/lib/api/types";
import { cn, formatDateTime, formatNumber, formatRelative } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

/**
 * Usage events as a timeline. `accounts` maps account ids to names (when showing several
 * accounts); `entitlements` maps entitlement ids to display names.
 */
export function ActivityFeed({
  appId,
  events,
  entitlements,
  accounts,
  showAccount = true,
  className,
}: {
  appId: string;
  events: UsageEvent[];
  entitlements: Map<string, string>;
  accounts?: Map<string, string>;
  showAccount?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {events.map((e, i) => {
        const name = entitlements.get(e.entitlement_id) ?? e.entitlement_id;
        const tone = e.amount < 0 ? "remove" : e.operation === "amount" ? "amount" : "add";
        return (
          <li key={e.id} className="relative flex gap-3 pb-3 last:pb-0">
            {i < events.length - 1 ? <span className="absolute left-[11px] top-6 h-[calc(100%-18px)] w-px bg-border" /> : null}
            <span
              className={cn(
                "relative z-[1] mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-bg [&_svg]:size-3",
                tone === "remove" ? "text-danger-fg" : tone === "amount" ? "text-accent-fg" : "text-success-fg",
              )}
            >
              {tone === "remove" ? <Minus /> : tone === "amount" ? <Sigma /> : <Plus />}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm text-fg">
                {showAccount ? (
                  <Link
                    href={`/apps/${appId}/accounts/${encodeURIComponent(e.namespace_id)}`}
                    className="font-medium hover:underline"
                  >
                    {accounts?.get(e.namespace_id) || e.namespace_id}
                  </Link>
                ) : null}
                {showAccount ? " " : ""}
                <span className={showAccount ? "text-fg-secondary" : "text-fg"}>
                  {e.amount < 0 ? "released" : "used"}{" "}
                  <span className="tabular font-medium text-fg">{formatNumber(Math.abs(e.amount))}</span> {name}
                </span>
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-tertiary">
                <Tooltip content={formatDateTime(e.created_at)}>
                  <span>{formatRelative(e.created_at)}</span>
                </Tooltip>
                <span>·</span>
                <span className="tabular">total {formatNumber(e.count)}</span>
                <span>·</span>
                <code>{e.operation}</code>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
