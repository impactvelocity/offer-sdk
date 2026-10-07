"use client";

import { Activity, ArrowRight, BookOpen, Check, Gift, House, Layers, Trophy, Users, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { BarList } from "@/components/analytics/bar-list";
import { ActivityFeed } from "@/components/analytics/activity-feed";
import { UsageAreaChart } from "@/components/charts/usage-chart";
import { PageBody, PageHeader } from "@/components/shell/page";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAccountCount,
  useAccounts,
  useAnalyticsSummary,
  useAnalyticsTimeseries,
  useApp,
  useAppId,
  useEntitlements,
  usePlans,
  useTopAccounts,
  useUsageEvents,
} from "@/lib/api/hooks";
import { usePlanAccountTotals } from "@/lib/use-plan-account-totals";
import { cn, formatNumber, pluralize } from "@/lib/utils";
import { StatStrip } from "./stat-strip";
import { buildUsageChart, rankedBy, useAccountNames, usageTrend } from "./usage-data";

const sum = (rows: { calls: number; total_amount: number }[] | null | undefined, key: "calls" | "total_amount") =>
  (rows ?? []).reduce((s, r) => s + r[key], 0);

function useEntitlementNames(appId: string) {
  const { data } = useEntitlements(appId);
  return useMemo(() => new Map(data?.map((e) => [e.id, e.name])), [data]);
}

export function OverviewView() {
  const appId = useAppId();
  const { data: app } = useApp(appId);
  const { data: plans } = usePlans(appId);
  const { data: count } = useAccountCount(appId);
  // A brand-new app leads with the checklist; the KPI strip would be all zeros.
  const isNew = plans?.length === 0 && count?.count === 0;

  return (
    <>
      <PageHeader
        icon={<House />}
        title="Overview"
        actions={
          <Link href={`/apps/${appId}/developers`} className={buttonVariants()}>
            <BookOpen />
            Integration Guide
          </Link>
        }
      />
      <PageBody width="wide">
        <div className="mb-6">
          {app ? (
            <h2 className="font-display text-xl font-semibold text-fg">{app.name}</h2>
          ) : (
            <Skeleton className="my-1 h-6 w-40" />
          )}
        </div>
        <SetupChecklist appId={appId} />
        {isNew ? null : <KpiStrip appId={appId} />}
        <div className="grid gap-4 lg:grid-cols-5">
          <UsageCard appId={appId} className="lg:col-span-3" />
          <AccountsByPlanCard appId={appId} className="lg:col-span-2" />
          <RecentActivityCard appId={appId} className="lg:col-span-3" />
          <TopAccountsCard appId={appId} className="lg:col-span-2" />
        </div>
      </PageBody>
    </>
  );
}

// ---------------------------------------------------------------------------
// Setup checklist

// "Hide" is remembered per app in localStorage (in memory when storage is blocked).
const hiddenKey = (appId: string) => `offer:setup-checklist-hidden:${appId}`;
const hiddenInMemory = new Set<string>();
const hiddenListeners = new Set<() => void>();

function subscribeHidden(listener: () => void) {
  hiddenListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    hiddenListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readHidden(appId: string) {
  if (hiddenInMemory.has(appId)) return true;
  try {
    return window.localStorage.getItem(hiddenKey(appId)) === "1";
  } catch {
    return false;
  }
}

function hideChecklist(appId: string) {
  hiddenInMemory.add(appId);
  try {
    window.localStorage.setItem(hiddenKey(appId), "1");
  } catch {}
  hiddenListeners.forEach((l) => l());
}

function SetupChecklist({ appId }: { appId: string }) {
  const base = `/apps/${appId}`;
  const entitlements = useEntitlements(appId);
  const plans = usePlans(appId);
  const count = useAccountCount(appId);
  const events = useUsageEvents(appId, { limit: 8 });
  const alltime = useAnalyticsSummary(appId, "alltime");
  // null on the server and during hydration, so storage is only read once mounted.
  const hidden = useSyncExternalStore(
    subscribeHidden,
    () => readHidden(appId),
    () => null,
  );
  const hide = () => hideChecklist(appId);

  // Tracked usage: the events endpoint when the API has it, else all-time calls.
  let tracked: boolean | undefined;
  if (events.data) tracked = events.data.length > 0;
  else if (events.data === null || events.isError) {
    tracked = alltime.data ? sum(alltime.data, "calls") > 0 : alltime.isError ? false : undefined;
  }
  if (hidden !== false || !entitlements.data || !plans.data || !count.data || tracked === undefined) return null;

  const steps = [
    {
      title: "Define entitlements",
      description: "The features and limits you gate: usage you count, or flags you switch on.",
      done: entitlements.data.length > 0,
      href: `${base}/entitlements?new=1`,
      cta: "Add Entitlement",
    },
    {
      title: "Create a plan with entitlements",
      description: "Bundle entitlements and their limits into the plans you offer.",
      done: plans.data.some((p) => p.entitlements.length > 0),
      href: `${base}/plans?new=1`,
      cta: "Create Plan",
    },
    {
      title: "Add your first account",
      description: "Each of your customers is an account with exactly one plan.",
      done: count.data.count > 0,
      href: `${base}/accounts?new=1`,
      cta: "Add Account",
    },
    {
      title: "Connect your app",
      description: "Check access and track usage from your code with your API key.",
      done: Boolean(tracked),
      href: `${base}/developers`,
      cta: "View Guide",
    },
    {
      title: "Publish a pricing card",
      description: "Render your pricing page straight from your plans.",
      done: plans.data.some((p) => p.pricingCard),
      href: `${base}/plans`,
      cta: "Open Plans",
      optional: true,
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  if (steps.every((s) => s.done || s.optional)) return null;
  const next = steps.findIndex((s) => !s.done);

  return (
    <Card className="mb-6">
      <div className="flex items-center gap-4 border-b border-border bg-bg-subtle px-5 py-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-fg">Get Set Up</h3>
          <p className="mt-0.5 text-sm text-fg-tertiary">A few steps and you can change access for any account from here.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-xs tabular text-fg-tertiary">
            {completed} of {steps.length}
          </span>
          <div
            role="progressbar"
            aria-valuenow={completed}
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-label="Setup progress"
            className="h-1 w-24 overflow-hidden rounded-full bg-bg-active"
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300"
              style={{ width: `${(completed / steps.length) * 100}%` }}
            />
          </div>
          <Button variant="ghost" size="xs" onClick={hide}>
            <X />
            Hide
          </Button>
        </div>
      </div>
      <ol>
        {steps.map((step, i) => (
          <li key={step.title} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0">
            {step.done ? (
              <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-success text-white">
                <Check className="size-3" strokeWidth={3} />
                <span className="sr-only">Done:</span>
              </span>
            ) : (
              <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full border border-border-strong text-[11px] font-medium tabular text-fg-tertiary">
                {i + 1}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-medium", step.done ? "text-fg-tertiary" : "text-fg")}>{step.title}</span>
                {step.optional ? <Badge>Optional</Badge> : null}
              </div>
              <p className={cn("truncate text-sm", step.done ? "text-fg-placeholder" : "text-fg-tertiary")}>{step.description}</p>
            </div>
            {step.done ? null : (
              <Link href={step.href} className={buttonVariants({ variant: i === next ? "primary" : "secondary", size: "xs" })}>
                {step.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// KPIs

function KpiStrip({ appId }: { appId: string }) {
  const { data: count } = useAccountCount(appId);
  const { data: plans } = usePlans(appId);
  const { data: withIncentive } = useAccounts(appId, { hasIncentive: true, perPage: 1 });
  const { data: summary } = useAnalyticsSummary(appId, "30d");
  const { data: timeseries } = useAnalyticsTimeseries(appId, "30d");

  const accounts = count?.count;
  const free = plans?.filter((p) => p.isFree).length ?? 0;
  const incentives = withIncentive?.total;
  const num = (v: number | undefined) => (v === undefined ? undefined : formatNumber(v));

  return (
    <StatStrip
      className="mb-4"
      stats={[
        { label: "Accounts", icon: <Users />, value: num(accounts), hint: plans ? `On ${pluralize(plans.length, "plan")}` : null },
        {
          label: "Plans",
          icon: <Layers />,
          value: num(plans?.length),
          hint: plans ? (free ? `${formatNumber(free)} free` : "No free plan") : null,
        },
        {
          label: "Accounts with an incentive",
          icon: <Gift />,
          value: num(incentives),
          hint: incentives !== undefined && accounts ? `${Math.round((incentives / accounts) * 100)}% of accounts` : null,
        },
        {
          label: "Usage events · 30d",
          icon: <Activity />,
          value: num(summary ? sum(summary, "calls") : undefined),
          hint: summary ? `${formatNumber(sum(summary, "total_amount"))} total usage` : null,
          trend: timeseries ? usageTrend(timeseries, "30d", "calls") : undefined,
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Widgets

function Widget({
  title,
  description,
  action,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <CardHeader title={title} description={description} actions={action} />
      <div className="flex flex-1 flex-col p-5">{children}</div>
    </Card>
  );
}

function WidgetLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonVariants({ variant: "ghost", size: "xs", className: "-my-1" })}>
      {children}
      <ArrowRight />
    </Link>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-8" />
      ))}
    </div>
  );
}

function UsageCard({ appId, className }: { appId: string; className?: string }) {
  const timeseries = useAnalyticsTimeseries(appId, "30d");
  const summary = useAnalyticsSummary(appId, "30d");
  const names = useEntitlementNames(appId);
  const chart = useMemo(
    () =>
      timeseries.data
        ? buildUsageChart(timeseries.data, { interval: "30d", metric: "calls", names, maxSeries: 4 })
        : null,
    [timeseries.data, names],
  );
  const empty = summary.data !== undefined && sum(summary.data, "calls") === 0;

  return (
    <Widget
      title="Usage · Last 30 Days"
      description={timeseries.data === null ? "Usage by Entitlement" : undefined}
      action={<WidgetLink href={`/apps/${appId}/analytics`}>Analytics</WidgetLink>}
      className={className}
    >
      {timeseries.isLoading || summary.isLoading ? (
        <Skeleton className="h-[200px]" />
      ) : summary.error ? (
        <p className="py-6 text-center text-sm text-fg-tertiary">Usage analytics aren&apos;t available right now.</p>
      ) : empty ? (
        <EmptyState
          compact
          icon={<Activity />}
          title="No usage yet"
          description="Usage shows up here once your app reports it through the usage endpoints."
          action={
            <Link href={`/apps/${appId}/developers`} className={buttonVariants()}>
              Track Usage
            </Link>
          }
          className="flex-1"
        />
      ) : chart ? (
        <UsageAreaChart
          data={chart.data}
          dataKey="__total"
          label="Usage events"
          granularity={chart.granularity}
          breakdown={chart.series.map((s) => ({ key: s.key, label: s.label }))}
        />
      ) : (
        <>
          <BarList
            items={[...(summary.data ?? [])]
              .sort((a, b) => b.total_amount - a.total_amount)
              .map((r) => ({
                key: r.entitlement_id,
                label: names.get(r.entitlement_id) ?? r.entitlement_id,
                value: r.total_amount,
                secondary: pluralize(r.calls, "call"),
              }))}
          />
          <p className="mt-3 text-xs text-fg-tertiary">A daily breakdown isn&apos;t available from the API yet.</p>
        </>
      )}
    </Widget>
  );
}

function AccountsByPlanCard({ appId, className }: { appId: string; className?: string }) {
  const { data: plans } = usePlans(appId);
  const { data: count } = useAccountCount(appId);
  const totals = usePlanAccountTotals(appId, plans?.map((p) => p.id) ?? []);
  const loading = !plans || !count || plans.some((p) => totals[p.id] === undefined);
  const accounts = count?.count ?? 0;

  return (
    <Widget
      title="Accounts by Plan"
      action={<WidgetLink href={`/apps/${appId}/plans`}>Plans</WidgetLink>}
      className={className}
    >
      {!plans || !count ? (
        <ListSkeleton />
      ) : plans.length === 0 ? (
        <EmptyState
          compact
          icon={<Layers />}
          title="No plans yet"
          description="Plans bundle entitlements and limits. Every account is on one."
          action={
            <Link href={`/apps/${appId}/plans?new=1`} className={buttonVariants()}>
              Create Plan
            </Link>
          }
          className="flex-1"
        />
      ) : accounts === 0 ? (
        <EmptyState
          compact
          icon={<Users />}
          title="No accounts yet"
          description="Accounts are created by your app, or by hand from the Accounts page."
          action={
            <Link href={`/apps/${appId}/accounts?new=1`} className={buttonVariants()}>
              Add Account
            </Link>
          }
          className="flex-1"
        />
      ) : loading ? (
        <ListSkeleton rows={Math.min(plans.length, 6)} />
      ) : (
        <BarList
          items={plans
            .map((p) => ({
              key: p.id,
              label: (
                <span className="flex items-center gap-1.5">
                  <span className="truncate">{p.name}</span>
                  {p.isFree ? <Badge color="green">Free</Badge> : null}
                </span>
              ),
              value: totals[p.id] ?? 0,
              secondary: `${Math.round(((totals[p.id] ?? 0) / accounts) * 100)}%`,
              href: `/apps/${appId}/plans/${encodeURIComponent(p.id)}`,
            }))
            .sort((a, b) => b.value - a.value)}
        />
      )}
    </Widget>
  );
}

function RecentActivityCard({ appId, className }: { appId: string; className?: string }) {
  const events = useUsageEvents(appId, { limit: 8 });
  const ids = useMemo(() => [...new Set(events.data?.map((e) => e.namespace_id))], [events.data]);
  const { names: accounts } = useAccountNames(appId, ids);
  const entitlements = useEntitlementNames(appId);

  return (
    <Widget title="Recent Activity" className={className}>
      {events.isLoading ? (
        <ListSkeleton rows={5} />
      ) : events.error ? (
        <p className="py-6 text-center text-sm text-fg-tertiary">Recent activity isn&apos;t available right now.</p>
      ) : events.data === null ? (
        <p className="py-6 text-center text-sm text-fg-tertiary">
          The hosted API doesn&apos;t expose individual usage events yet. Totals are on the Analytics page.
        </p>
      ) : !events.data?.length ? (
        <EmptyState
          compact
          icon={<Activity />}
          title="No activity yet"
          description="Each usage event your app tracks appears here as it happens."
          className="flex-1"
        />
      ) : (
        <ActivityFeed appId={appId} events={events.data} entitlements={entitlements} accounts={accounts} />
      )}
    </Widget>
  );
}

function TopAccountsCard({ appId, className }: { appId: string; className?: string }) {
  const top = useTopAccounts(appId, "30d", undefined, 5);
  const ids = useMemo(() => top.data?.map((r) => r.namespace_id) ?? [], [top.data]);
  const { names } = useAccountNames(appId, ids);
  const metric = top.data ? rankedBy(top.data) : "calls";

  return (
    <Widget
      title="Top Accounts · 30d"
      action={<WidgetLink href={`/apps/${appId}/analytics`}>All</WidgetLink>}
      className={className}
    >
      {top.isLoading ? (
        <ListSkeleton rows={5} />
      ) : top.error ? (
        <p className="py-6 text-center text-sm text-fg-tertiary">Top accounts aren&apos;t available right now.</p>
      ) : !top.data?.length ? (
        <EmptyState
          compact
          icon={<Trophy />}
          title="No active accounts"
          description="Accounts with the most usage in the last 30 days appear here."
          className="flex-1"
        />
      ) : (
        <BarList
          items={top.data.map((r) => ({
            key: r.namespace_id,
            icon: <Avatar name={names.get(r.namespace_id) ?? r.namespace_id} seed={r.namespace_id} size="xs" />,
            label: names.get(r.namespace_id) ?? <span className="text-fg-secondary">{r.namespace_id}</span>,
            value: r[metric],
            secondary: metric === "calls" ? (r.calls === 1 ? "event" : "events") : "used",
            href: `/apps/${appId}/accounts/${encodeURIComponent(r.namespace_id)}`,
          }))}
        />
      )}
    </Widget>
  );
}
