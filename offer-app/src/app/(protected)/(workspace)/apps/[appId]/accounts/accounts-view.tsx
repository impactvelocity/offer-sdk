"use client";

import {
  CalendarDays,
  CircleAlert,
  Code,
  ExternalLink,
  Gift,
  Hash,
  Layers,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Callout } from "@/components/ui/callout";
import { ChangePlanDialog } from "@/components/accounts/change-plan-dialog";
import { CreateAccountDialog } from "@/components/accounts/create-account-dialog";
import { RefChip } from "@/components/accounts/ref-chips";
import { Pagination } from "@/components/catalog/pagination";
import { RowMenu } from "@/components/catalog/row-menu";
import { PageBody, PageHeader, Toolbar } from "@/components/shell/page";
import { Avatar } from "@/components/ui/avatar";
import { IdTag } from "@/components/ui/badge";
import { Button, buttonVariants, Spinner } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { InputGroup } from "@/components/ui/input";
import { MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyCell, Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { api } from "@/lib/api/client";
import { useAccountCount, useAccounts, useApiMutation, useAppId, useIncentives, usePlans } from "@/lib/api/hooks";
import type { AccountHit } from "@/lib/api/types";
import { useNewParam } from "@/lib/use-new-param";
import { cn, formatRelative } from "@/lib/utils";

const PER_PAGE = 25;
const ALL = "__all";
/** `?incentive=__any`: accounts with any incentive. */
const ANY = "__any";

const exactDate = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });

export function AccountsView() {
  const appId = useAppId();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useNewParam();
  const [changing, setChanging] = useState<AccountHit | null>(null);
  const { data: plans = [], isLoading: plansLoading } = usePlans(appId);
  const { data: incentives = [], isLoading: incentivesLoading } = useIncentives(appId);
  const accountCount = useAccountCount(appId);

  // Filters live in the URL so plan/incentive pages can link here (?plan=pro, ?incentive=beta).
  const q = params.get("q") ?? "";
  const plan = params.get("plan") ?? "";
  const incentive = params.get("incentive") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const hasFilters = Boolean(q || plan || incentive);

  // Replace (not push) and skip the server round trip; Next syncs useSearchParams with it.
  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (!("page" in patch)) next.delete("page");
      window.history.replaceState(null, "", next.size ? `${pathname}?${next}` : pathname);
    },
    [pathname],
  );

  // Debounced search. Adopt q from the URL only when it changed from elsewhere (e.g. the sidebar link).
  const [search, setSearch] = useState(q);
  const [written, setWritten] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    if (q !== written) {
      setSearch(q);
      setWritten(q);
    }
  }
  useEffect(() => {
    const next = search.trim();
    if (next === q) return;
    const timer = setTimeout(() => {
      setWritten(next);
      setParams({ q: next || null });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, q, setParams]);

  const clearFilters = () => {
    setSearch("");
    setWritten("");
    setParams({ q: null, plan: null, incentive: null });
  };

  const { data, isLoading, isFetching, isPlaceholderData, error, refetch } = useAccounts(appId, {
    q: q || undefined,
    plan: plan || undefined,
    incentive: incentive && incentive !== ANY ? incentive : undefined,
    hasIncentive: incentive === ANY || undefined,
    page,
    perPage: PER_PAGE,
  });
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  // Deleting the last row of the last page leaves an empty page behind.
  useEffect(() => {
    if (data && !isPlaceholderData && page > 1 && !data.data.length && data.total > 0) {
      setParams({ page: String(Math.ceil(data.total / PER_PAGE)) });
    }
  }, [data, isPlaceholderData, page, setParams]);

  const planName = useMemo(() => new Map(plans.map((p) => [p.id, p.name])), [plans]);
  const incentiveName = useMemo(() => new Map(incentives.map((i) => [i.id, i.name])), [incentives]);
  const noPlans = !plansLoading && !plans.length;

  const planOptions = [
    { value: ALL, label: "All plans" },
    ...plans.map((p) => ({ value: p.id, label: p.name, icon: <Layers /> })),
    ...(plan && !plansLoading && !planName.has(plan) ? [{ value: plan, label: plan, icon: <Layers /> }] : []),
  ];
  const incentiveOptions = [
    { value: ALL, label: "Any incentive" },
    { value: ANY, label: "Has an incentive" },
    ...incentives.map((i) => ({ value: i.id, label: i.name, icon: <Gift /> })),
    ...(incentive && incentive !== ANY && !incentivesLoading && !incentiveName.has(incentive)
      ? [{ value: incentive, label: incentive, icon: <Gift /> }]
      : []),
  ];

  const remove = useApiMutation((id: string) => api.accounts.delete(appId, id), { success: "Account deleted" });

  const onDelete = (a: AccountHit) =>
    confirm({
      title: `Delete ${a.name || a.id}?`,
      description:
        "Your app's access checks for this account will fail until it's created again. Its usage history is kept.",
      typeToConfirm: a.id,
      confirmLabel: "Delete Account",
      onConfirm: () => remove.mutateAsync(a.id),
    });

  const copyId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    toast.success("Account ID copied");
  };

  const open = (id: string) => router.push(`/apps/${appId}/accounts/${encodeURIComponent(id)}`);

  const newButton = (
    <Button variant="primary" disabled={noPlans} onClick={() => setCreateOpen(true)}>
      <Plus />
      New Account
    </Button>
  );

  return (
    <>
      <PageHeader
        icon={<Users />}
        title="Accounts"
        actions={
          noPlans ? (
            <Tooltip content="Create a plan first">
              <span tabIndex={0} className="rounded-md outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]">
                {newButton}
              </span>
            </Tooltip>
          ) : (
            newButton
          )
        }
      />
      <Toolbar>
        <InputGroup
          size="sm"
          leading={<Search />}
          trailing={isFetching && isPlaceholderData ? <Spinner className="mr-1.5 text-fg-tertiary" /> : null}
          placeholder="Search by name or ID"
          aria-label="Search accounts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setSearch("")}
          wrapperClassName="w-64"
        />
        <Select
          size="sm"
          aria-label="Filter by plan"
          className="w-44"
          value={plan || ALL}
          onValueChange={(v) => setParams({ plan: v === ALL ? null : v })}
          options={planOptions}
        />
        <Select
          size="sm"
          aria-label="Filter by incentive"
          className="w-48"
          value={incentive || ALL}
          onValueChange={(v) => setParams({ incentive: v === ALL ? null : v })}
          options={incentiveOptions}
        />
        {hasFilters ? (
          <Button variant="ghost" onClick={clearFilters}>
            <X />
            Clear
          </Button>
        ) : null}
      </Toolbar>
      <PageBody>
        {noPlans ? (
          <div className="border-b border-border px-6 py-3">
            <Callout
              tone="warning"
              action={
                <Link href={`/apps/${appId}/plans?new=1`} className={buttonVariants({ size: "xs" })}>
                  <Layers />
                  Create a Plan
                </Link>
              }
            >
              Create a plan first — every account needs one.
            </Callout>
          </div>
        ) : null}
        {isLoading ? (
          <div className="flex flex-col gap-2 p-6">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : error && !data ? (
          <EmptyState
            icon={<CircleAlert />}
            title="Couldn't load accounts"
            description={error.message}
            action={<Button onClick={() => refetch()}>Try Again</Button>}
          />
        ) : total === 0 && (!hasFilters || accountCount.data?.count === 0) ? (
          <EmptyState
            icon={<Users />}
            title="No accounts yet"
            description="Accounts are your end customers: each one is on a plan and can carry an incentive. They're usually created by your app when a user signs up."
            action={
              <>
                {noPlans ? null : (
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <Plus />
                    Create Account
                  </Button>
                )}
                <Link href={`/apps/${appId}/developers`} className={buttonVariants()}>
                  <Code />
                  Create from Your App
                </Link>
              </>
            }
          />
        ) : total === 0 ? (
          <EmptyState
            icon={<Search />}
            title="No accounts match"
            description={q ? `Nothing matches “${q}” with these filters.` : "No accounts match these filters."}
            action={<Button onClick={clearFilters}>Clear Filters</Button>}
          />
        ) : (
          <div className={cn("transition-opacity duration-150", isFetching && isPlaceholderData && "opacity-60")}>
            <TableContainer>
              <Table>
                <THead>
                  <tr>
                    <TH icon={<Users />} className="min-w-56">
                      Account
                    </TH>
                    <TH icon={<Hash />}>ID</TH>
                    <TH icon={<Layers />}>Plan</TH>
                    <TH icon={<Gift />}>Incentive</TH>
                    <TH icon={<CalendarDays />}>Created</TH>
                    <TH className="w-10" />
                  </tr>
                </THead>
                <TBody>
                  {rows.map((a) => (
                    <TR key={a.id} interactive onClick={() => open(a.id)}>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Avatar name={a.name || a.id} seed={a.id} />
                          <span className="truncate font-medium">{a.name || a.id}</span>
                        </div>
                      </TD>
                      <TD>
                        <IdTag>{a.id}</IdTag>
                      </TD>
                      <TD>
                        <RefChip kind="plan" appId={appId} id={a.plan} name={planName.get(a.plan)} loading={plansLoading} />
                      </TD>
                      <TD>
                        {a.incentive ? (
                          <RefChip
                            kind="incentive"
                            appId={appId}
                            id={a.incentive}
                            name={incentiveName.get(a.incentive)}
                            loading={incentivesLoading}
                          />
                        ) : (
                          <EmptyCell />
                        )}
                      </TD>
                      <TD className="whitespace-nowrap text-fg-secondary">
                        <Tooltip content={exactDate(a.created_at)}>
                          <span>{formatRelative(a.created_at * 1000)}</span>
                        </Tooltip>
                      </TD>
                      <TD className="px-1">
                        <RowMenu>
                          <MenuItem onClick={() => open(a.id)}>
                            <ExternalLink />
                            Open
                          </MenuItem>
                          <MenuItem onClick={() => setChanging(a)}>
                            <Layers />
                            Change plan…
                          </MenuItem>
                          <MenuItem onClick={() => copyId(a.id)}>
                            <Hash />
                            Copy ID
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem tone="danger" onClick={() => onDelete(a)}>
                            <Trash2 />
                            Delete
                          </MenuItem>
                        </RowMenu>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
            <Pagination
              page={page}
              perPage={PER_PAGE}
              total={total}
              onPageChange={(p) => setParams({ page: p > 1 ? String(p) : null })}
            />
          </div>
        )}
      </PageBody>
      <CreateAccountDialog appId={appId} open={createOpen} onOpenChange={setCreateOpen} />
      <ChangePlanDialog
        appId={appId}
        account={changing}
        open={Boolean(changing)}
        onOpenChange={(o) => !o && setChanging(null)}
      />
    </>
  );
}
