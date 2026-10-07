"use client";

import { Braces, Check, Search, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DrawerHeader } from "@/components/catalog/use-sdk-api";
import * as snippets from "@/components/developers/snippets";
import { useDevContext } from "@/components/developers/use-dev-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CodeTabs } from "@/components/ui/code-block";
import { useConfirm } from "@/components/ui/confirm";
import { InputGroup } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { api } from "@/lib/api/client";
import { useAccounts, useApiMutation, useIncentives, usePlans } from "@/lib/api/hooks";
import type { AccountHit, Incentive } from "@/lib/api/types";

function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Search accounts and apply this incentive to one, replacing whatever incentive it had. */
export function ApplyToAccount({ appId, incentive }: { appId: string; incentive: Incentive }) {
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim());
  const { data, isLoading, isFetching, error } = useAccounts(appId, { q, perPage: 5 });
  const { data: plans = [] } = usePlans(appId);
  const { data: incentives = [] } = useIncentives(appId);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [apiOpen, setApiOpen] = useState(false);
  const confirm = useConfirm();

  const planName = new Map(plans.map((p) => [p.id, p.name]));
  const incentiveName = new Map(incentives.map((i) => [i.id, i.name]));

  const apply = useApiMutation(
    (account: AccountHit) => api.accounts.update(appId, account.namespace_id || account.id, { incentive: incentive.id }),
    {
      success: (_, account) => `${incentive.name} applied to ${account.name || account.id}`,
    },
  );

  const remove = useApiMutation((account: AccountHit) => api.accounts.removeIncentive(appId, account.namespace_id || account.id), {
    success: (_, account) => `${incentive.name} removed from ${account.name || account.id}`,
  });

  const onApply = async (account: AccountHit) => {
    const name = account.name || account.id;
    const replaces = account.incentive ? (incentiveName.get(account.incentive) ?? account.incentive) : null;
    const ok = await confirm({
      tone: "default",
      title: `Apply ${incentive.name} to ${name}?`,
      description: replaces
        ? `This replaces ${replaces}. ${name} gets ${incentive.name}'s limits and add-ons immediately.`
        : `${name} gets ${incentive.name}'s limits and add-ons immediately. Their plan doesn't change.`,
      confirmLabel: "Apply",
    });
    if (!ok) return;
    setPendingId(account.id);
    apply.mutate(account, { onSettled: () => setPendingId(null) });
  };

  const onRemove = async (account: AccountHit) => {
    const name = account.name || account.id;
    const ok = await confirm({
      title: `Remove ${incentive.name} from ${name}?`,
      description: `${name} falls back to ${planName.get(account.plan) ?? account.plan}'s limits and add-ons immediately.`,
      confirmLabel: "Remove",
    });
    if (!ok) return;
    setPendingId(account.id);
    remove.mutate(account, { onSettled: () => setPendingId(null) });
  };

  const busy = apply.isPending || remove.isPending;

  const rows = data?.data ?? [];

  return (
    <div className="flex flex-col gap-2">
      <InputGroup
        size="sm"
        leading={<Search />}
        placeholder="Search accounts by name or ID"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search accounts"
      />
      {isLoading ? (
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : error ? (
        <p className="py-2 text-sm text-danger-fg">Couldn&apos;t search accounts: {error.message}</p>
      ) : !rows.length ? (
        <p className="py-2 text-sm text-fg-tertiary">{q ? `No accounts match “${q}”.` : "No accounts yet."}</p>
      ) : (
        <ul className={isFetching && !isLoading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {!q ? <li className="pb-1 text-xs text-fg-tertiary">Recent accounts</li> : null}
          {rows.map((account) => {
            const applied = account.incentive === incentive.id;
            const replaces = account.incentive && !applied ? account.incentive : null;
            return (
              <li key={account.id} className="group/row flex items-center gap-2 border-b border-border py-1.5 last:border-b-0">
                <Avatar name={account.name || account.id} seed={account.id} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/apps/${appId}/accounts/${encodeURIComponent(account.id)}`}
                    className="block truncate text-sm font-medium text-fg hover:underline"
                  >
                    {account.name || account.id}
                  </Link>
                  <div className="truncate text-xs text-fg-tertiary">
                    {planName.get(account.plan) ?? account.plan}
                    {replaces ? (
                      <span className="text-warning-fg">
                        {" "}
                        · <TriangleAlert className="inline size-3 -translate-y-px" /> replaces{" "}
                        {incentiveName.get(replaces) ?? replaces}
                      </span>
                    ) : null}
                  </div>
                </div>
                {applied ? (
                  <span className="flex items-center gap-0.5">
                    <span className="flex h-6 items-center gap-1 px-1 text-xs font-medium text-success-fg [&_svg]:size-3.5">
                      <Check />
                      Applied
                    </span>
                    <Tooltip content="Remove incentive">
                      <Button
                        icon
                        size="xs"
                        variant="ghost"
                        aria-label={`Remove ${incentive.name} from ${account.name || account.id}`}
                        loading={pendingId === account.id}
                        disabled={busy}
                        className={
                          pendingId === account.id ? undefined : "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
                        }
                        onClick={() => onRemove(account)}
                      >
                        <X />
                      </Button>
                    </Tooltip>
                  </span>
                ) : (
                  <Button
                    size="xs"
                    loading={pendingId === account.id}
                    disabled={busy}
                    onClick={() => onApply(account)}
                  >
                    Apply
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Button size="xs" variant="ghost" className="self-start" onClick={() => setApiOpen(true)}>
        <Braces />
        Apply from Your Backend
      </Button>
      <Sheet open={apiOpen} onOpenChange={setApiOpen}>
        <SheetContent className="max-w-[640px]">
          <ApplyWithApi incentive={incentive} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ApplyWithApi({ incentive }: { incentive: Incentive }) {
  const ctx = useDevContext();
  const s = useMemo(() => snippets.toSnippetContext(ctx, false), [ctx]);
  return (
    <>
      <DrawerHeader
        title="Apply from your backend"
        description={`Apply ${incentive.name} when something happens in your app, like a checkout with a promo code or a support save offer. Use your secret key.`}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 scrollbar-thin">
        {s ? <CodeTabs tabs={snippets.applyIncentive(s, incentive.id)} /> : <Skeleton className="h-64" />}
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-fg-tertiary">
          <li>An account has at most one incentive; applying a new one replaces it.</li>
          <li>Changes apply instantly: the next plan check returns the new limits and add-ons.</li>
          <li>Removing it never touches usage counters or the account&apos;s plan.</li>
        </ul>
        <Link href={`/apps/${ctx.appId}/developers/api`} className="text-sm text-accent-fg hover:underline">
          Full API reference
        </Link>
      </div>
    </>
  );
}
