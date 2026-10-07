"use client";

import {
  Activity,
  BookmarkPlus,
  BookOpen,
  ChartColumn,
  Divide,
  Info,
  KeyRound,
  Percent,
  RotateCw,
  Sigma,
  ToggleRight,
  TriangleAlert,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { EntitlementPicker, selectionLabel } from "@/components/analytics/entitlement-picker";
import { intervalLabel, PeriodPicker } from "@/components/analytics/period-picker";
import {
  ReportNameDialog,
  ReportsMenu,
  reportSummary,
  sameIds,
  useReportMutations,
} from "@/components/analytics/saved-reports";
import { ChartLegend, type ChartSeries } from "@/components/charts/chart-legend";
import { OTHER_COLOR, OTHER_KEY } from "@/components/charts/palette";
import { UsageBarChart } from "@/components/charts/usage-chart";
import { PageBody, PageHeader, Toolbar } from "@/components/shell/page";
import { Avatar } from "@/components/ui/avatar";
import { Badge, IdTag } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyCell, Table, TableContainer, TableFooter, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  useAnalyticsSummary,
  useAnalyticsTimeseries,
  useAppId,
  useEntitlements,
  useSavedReports,
  useTopAccounts,
} from "@/lib/api/hooks";
import type {
  AnalyticsInterval,
  Entitlement,
  EntitlementUsageSummary,
  SavedReport,
  TopAccountUsage,
} from "@/lib/api/types";
import { cn, formatNumber, pluralize } from "@/lib/utils";
import { StatStrip } from "../stat-strip";
import { buildUsageChart, rankedBy, useAccountNames, useEntitlementColors, usageTrend, type UsageMetric } from "../usage-data";

const TOP_LIMIT = 100;
const NONE: ReadonlySet<string> = new Set();
const decimal = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

const sum = (rows: EntitlementUsageSummary[], key: UsageMetric) => rows.reduce((s, r) => s + r[key], 0);

function formatShare(ratio: number) {
  const pct = ratio * 100;
  return pct > 0 && pct < 1 ? "<1%" : `${Math.round(pct)}%`;
}

export function AnalyticsView() {
  const appId = useAppId();
  const [period, setPeriod] = useState<AnalyticsInterval>("30d");
  // Entitlements the page focuses on; empty means all of them.
  const [selected, setSelectedState] = useState<string[]>([]);
  const [metric, setMetric] = useState<UsageMetric>("total_amount");
  const [hiddenKeys, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [reportId, setReportId] = useState<string | null>(null);
  const [nameDialog, setNameDialog] = useState<"create" | "rename" | null>(null);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filtered = selected.length > 0;
  const confirm = useConfirm();

  const { data: entitlements } = useEntitlements(appId);
  const summary = useAnalyticsSummary(appId, period);
  const alltime = useAnalyticsSummary(appId, "alltime");
  const timeseries = useAnalyticsTimeseries(appId, period);
  const top = useTopAccounts(appId, period, filtered ? selected : undefined, TOP_LIMIT);
  const colors = useEntitlementColors(appId);
  const reports = useSavedReports(appId);
  const reportMutations = useReportMutations(appId);

  const catalog = useMemo(() => new Map(entitlements?.map((e) => [e.id, e])), [entitlements]);
  const names = useMemo(() => new Map(entitlements?.map((e) => [e.id, e.name])), [entitlements]);
  const nameOf = (id: string) => names.get(id) ?? id;

  const activeReport = reports.data?.find((r) => r.id === reportId) ?? null;
  const dirty = activeReport
    ? activeReport.interval !== period || !sameIds(activeReport.entitlements, selected)
    : false;
  const currentView = { entitlements: selected, interval: period };

  const setSelected = (ids: string[]) => {
    setSelectedState(ids);
    setHidden(new Set());
  };
  const toggleSelected = (id: string) =>
    setSelected(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const applyReport = (report: SavedReport) => {
    setReportId(report.id);
    setPeriod(report.interval);
    setSelected(report.entitlements);
  };

  const saveNew = (name: string) =>
    reportMutations.create.mutate(
      { name, ...currentView },
      {
        onSuccess: (r) => {
          setReportId(r.id);
          setNameDialog(null);
        },
      },
    );
  const updateActive = () =>
    activeReport && reportMutations.update.mutate({ id: activeReport.id, patch: currentView });
  const renameActive = (name: string) =>
    activeReport &&
    reportMutations.update.mutate({ id: activeReport.id, patch: { name } }, { onSuccess: () => setNameDialog(null) });
  const deleteActive = async () => {
    if (!activeReport) return;
    const ok = await confirm({
      title: `Delete “${activeReport.name}”?`,
      description: "Only the saved view is removed. Usage data isn't affected.",
      confirmLabel: "Delete report",
      tone: "danger",
      onConfirm: () => reportMutations.remove.mutateAsync(activeReport.id),
    });
    if (ok) setReportId(null);
  };

  const all = useMemo(() => summary.data ?? [], [summary.data]);
  const scoped = useMemo(
    () => (filtered ? all.filter((r) => selectedSet.has(r.entitlement_id)) : all),
    [all, filtered, selectedSet],
  );

  const chart = useMemo(() => {
    if (!timeseries.data || !colors) return null;
    const rows = filtered ? timeseries.data.filter((r) => selectedSet.has(r.entitlement_id)) : timeseries.data;
    const built = buildUsageChart(rows, { interval: period, metric, colors, names, maxSeries: 5 });
    // Legend totals come from the summary so they match the stats and the table.
    const shown = new Set(built.series.map((s) => s.key));
    const series: ChartSeries[] = built.series.map((s) => ({
      ...s,
      total:
        s.key === OTHER_KEY
          ? sum(scoped.filter((r) => !shown.has(r.entitlement_id)), metric)
          : (scoped.find((r) => r.entitlement_id === s.key)?.[metric] ?? 0),
    }));
    return { ...built, series };
  }, [timeseries.data, colors, filtered, selectedSet, period, metric, names, scoped]);

  const trends = useMemo(() => {
    if (!timeseries.data) return undefined;
    const rows = filtered ? timeseries.data.filter((r) => selectedSet.has(r.entitlement_id)) : timeseries.data;
    return { amount: usageTrend(rows, period, "total_amount"), calls: usageTrend(rows, period, "calls") };
  }, [timeseries.data, filtered, selectedSet, period]);

  // Legend toggles apply to the multi-series view; never let them blank the chart.
  const hidden =
    selected.length === 1 || !chart || chart.series.every((s) => hiddenKeys.has(s.key)) ? NONE : hiddenKeys;

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      // Never hide the last visible series.
      else if (chart && chart.series.filter((s) => !next.has(s.key)).length > 1) next.add(key);
      return next;
    });

  // How each entitlement is drawn in the chart, so the table doubles as its key.
  const swatch = (id: string) => {
    if (!chart || (filtered && !selectedSet.has(id))) return undefined;
    const series = chart.series.find((s) => s.key === id);
    if (series) return hidden.has(id) ? undefined : series.color;
    const hasOther = chart.series.some((s) => s.key === OTHER_KEY);
    return hasOther && !hidden.has(OTHER_KEY) ? OTHER_COLOR : undefined;
  };

  const periodEmpty = summary.data !== undefined && sum(all, "calls") === 0;
  const hasAnyUsage = alltime.data ? sum(alltime.data, "calls") > 0 : false;

  let body: ReactNode;
  if (summary.isLoading) {
    body = (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[94px]" />
        <Skeleton className="h-[380px]" />
        <Skeleton className="h-56" />
      </div>
    );
  } else if (summary.error) {
    body = (
      <EmptyState
        icon={<TriangleAlert />}
        title="Analytics unavailable"
        description={summary.error.message}
        action={
          <Button onClick={() => summary.refetch()} loading={summary.isFetching}>
            <RotateCw />
            Try again
          </Button>
        }
      />
    );
  } else if (periodEmpty) {
    body = (
      <EmptyState
        icon={<ChartColumn />}
        title={period === "alltime" || !hasAnyUsage ? "No usage tracked yet" : `No usage in the ${intervalLabel(period).toLowerCase()}`}
        description="Usage appears here once your app calls the usage endpoints (add, remove or set an amount) for its accounts."
        action={
          <>
            <Link href={`/apps/${appId}/developers`} className={buttonVariants({ variant: "primary" })}>
              <BookOpen />
              Integration guide
            </Link>
            {period !== "alltime" && hasAnyUsage ? <Button onClick={() => setPeriod("alltime")}>Show all time</Button> : null}
          </>
        }
      />
    );
  } else {
    const filterName = filtered ? selectionLabel(selected, nameOf) : undefined;
    body = (
      <div className={cn("flex flex-col gap-4 transition-opacity", summary.isPlaceholderData && "opacity-60")}>
        <UsageStats
          all={all}
          scoped={scoped}
          filterName={filterName}
          nameOf={nameOf}
          active={top.data?.length}
          trends={trends}
        />

        <Card>
          <CardHeader
            title="Usage over time"
            description={[
              filterName,
              intervalLabel(period),
              chart ? (chart.granularity === "week" ? "Weekly" : "Daily") : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            actions={
              timeseries.data ? (
                <Segmented
                  size="xs"
                  value={metric}
                  onValueChange={setMetric}
                  options={[
                    { value: "total_amount", label: "Amount" },
                    { value: "calls", label: "Calls" },
                  ]}
                />
              ) : null
            }
          />
          <div className="p-5">
            {timeseries.isLoading || (timeseries.data && !colors) ? (
              <Skeleton className="h-[296px]" />
            ) : timeseries.error ? (
              <Note icon={<TriangleAlert />}>Usage over time couldn&apos;t be loaded. Totals for the period are below.</Note>
            ) : !chart ? (
              <Note icon={<Info />}>
                The hosted API doesn&apos;t expose usage over time yet. Totals for the period are in the tables below.
              </Note>
            ) : !chart.series.length ? (
              <EmptyState
                compact
                icon={<ChartColumn />}
                title="Nothing to chart"
                description={`${filterName ?? "This app"} has no usage in the ${intervalLabel(period).toLowerCase()}.`}
              />
            ) : (
              <>
                {chart.series.length > 1 ? (
                  <ChartLegend className="-ml-1.5 mb-2" series={chart.series} hidden={hidden} onToggle={toggle} />
                ) : null}
                <UsageBarChart
                  data={chart.data}
                  series={chart.series}
                  hidden={hidden}
                  granularity={chart.granularity}
                  height={chart.series.length > 1 ? 266 : 296}
                />
              </>
            )}
          </div>
        </Card>

        <ByEntitlement
          all={all}
          catalog={catalog}
          swatch={swatch}
          selected={selectedSet}
          onToggle={toggleSelected}
        />

        <TopAccounts
          appId={appId}
          rows={top.data}
          loading={top.isLoading}
          error={top.error}
          description={`${filterName ?? "All entitlements"} · ${intervalLabel(period)}`}
          emptyText={filterName ? `No account used ${filterName} in this period.` : "No account has usage in this period."}
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader icon={<ChartColumn />} title="Analytics" />
      <Toolbar
        actions={
          // Hidden on an API version without saved reports.
          reports.data ? (
            activeReport ? (
              dirty ? (
                <>
                  <Button variant="ghost" onClick={() => applyReport(activeReport)}>
                    Reset
                  </Button>
                  <Button onClick={updateActive} loading={reportMutations.update.isPending}>
                    Update report
                  </Button>
                </>
              ) : null
            ) : (
              <Button onClick={() => setNameDialog("create")}>
                <BookmarkPlus />
                Save report
              </Button>
            )
          ) : null
        }
      >
        {reports.data ? (
          <ReportsMenu
            reports={reports.data}
            active={activeReport}
            dirty={dirty}
            nameOf={nameOf}
            onApply={applyReport}
            onSaveNew={() => setNameDialog("create")}
            onUpdate={updateActive}
            onRename={() => setNameDialog("rename")}
            onDelete={deleteActive}
          />
        ) : null}
        <PeriodPicker value={period} onValueChange={setPeriod} />
        <EntitlementPicker
          className="w-56"
          entitlements={entitlements ?? []}
          value={selected}
          onValueChange={setSelected}
        />
        <span className="ml-1 text-sm text-fg-tertiary">{intervalLabel(period)}</span>
      </Toolbar>
      <PageBody width="wide">{body}</PageBody>
      <ReportNameDialog
        open={nameDialog !== null}
        onOpenChange={(open) => !open && setNameDialog(null)}
        mode={nameDialog ?? "create"}
        initialName={nameDialog === "rename" && activeReport ? activeReport.name : filtered ? selectionLabel(selected, nameOf) : ""}
        summary={reportSummary(nameDialog === "rename" && activeReport ? activeReport : currentView, nameOf)}
        pending={reportMutations.create.isPending || reportMutations.update.isPending}
        onSubmit={nameDialog === "rename" ? renameActive : saveNew}
      />
    </>
  );
}

function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-bg-subtle px-4 py-3 text-sm text-fg-secondary [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-tertiary">
      {icon}
      <p>{children}</p>
    </div>
  );
}

function UsageStats({
  all,
  scoped,
  filterName,
  nameOf,
  active,
  trends,
}: {
  all: EntitlementUsageSummary[];
  scoped: EntitlementUsageSummary[];
  filterName?: string;
  nameOf: (id: string) => string;
  active: number | undefined;
  trends?: { amount: number[]; calls: number[] };
}) {
  const amount = sum(scoped, "total_amount");
  const calls = sum(scoped, "calls");
  const grand = sum(all, "total_amount");
  const leader = [...all].sort((a, b) => b.total_amount - a.total_amount)[0];
  const share = (value: number) => (grand > 0 ? formatShare(Math.max(0, value) / grand) : "—");

  return (
    <StatStrip
      stats={[
        {
          label: "Total usage",
          icon: <Sigma />,
          value: formatNumber(amount),
          hint: filterName ?? `Across ${pluralize(all.length, "entitlement")}`,
          trend: trends?.amount,
        },
        {
          label: "Tracking calls",
          icon: <Activity />,
          value: formatNumber(calls),
          hint: calls ? `${decimal.format(amount / calls)} per call on average` : "No calls",
          trend: trends?.calls,
        },
        {
          label: "Active accounts",
          icon: <Users />,
          value: active === undefined ? undefined : active >= TOP_LIMIT ? `${TOP_LIMIT}+` : formatNumber(active),
          hint: "With usage in this period",
        },
        filterName
          ? {
              label: "Share of usage",
              icon: <Percent />,
              value: share(amount),
              hint: `Of ${formatNumber(grand)} across all entitlements`,
            }
          : {
              label: "Top entitlement",
              icon: <Trophy />,
              value: leader ? <span className="block truncate">{nameOf(leader.entitlement_id)}</span> : "—",
              hint: leader ? `${share(leader.total_amount)} of total usage` : null,
            },
      ]}
    />
  );
}

function ByEntitlement({
  all,
  catalog,
  swatch,
  selected,
  onToggle,
}: {
  all: EntitlementUsageSummary[];
  catalog: Map<string, Entitlement>;
  swatch: (id: string) => string | undefined;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  const grand = sum(all, "total_amount");
  const seen = new Set(all.map((r) => r.entitlement_id));
  // Metered entitlements without usage are listed too, so gaps are visible.
  const rows = [
    ...all,
    ...[...catalog.values()]
      .filter((e) => e.type === "usage" && !seen.has(e.id))
      .map((e) => ({ entitlement_id: e.id, calls: 0, total_amount: 0 })),
  ].sort((a, b) => b.total_amount - a.total_amount || b.calls - a.calls);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="By entitlement"
        description="Select rows to focus the page on them, e.g. AI credits alone or together with another entitlement."
      />
      <TableContainer className="[&_tbody_tr:last-child>td]:border-b-0">
        <Table>
          <THead>
            <tr>
              <TH icon={<KeyRound />} className="min-w-64">
                Entitlement
              </TH>
              <TH icon={<ToggleRight />}>Type</TH>
              <TH icon={<Sigma />} align="right">
                Total usage
              </TH>
              <TH icon={<Activity />} align="right">
                Calls
              </TH>
              <TH icon={<Divide />} align="right">
                Avg per call
              </TH>
              <TH icon={<Percent />} className="w-48">
                Share
              </TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => {
              const ent = catalog.get(r.entitlement_id);
              const isSelected = selected.has(r.entitlement_id);
              const color = swatch(r.entitlement_id);
              const ratio = grand > 0 ? Math.max(0, r.total_amount) / grand : 0;
              return (
                <TR
                  key={r.entitlement_id}
                  interactive
                  aria-selected={isSelected}
                  onClick={() => onToggle(r.entitlement_id)}
                  className={cn(isSelected && "[&>td]:bg-accent-subtle [&>td]:hover:bg-accent-subtle")}
                >
                  <TD>
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-[2px]"
                        style={color ? { background: color } : { boxShadow: "inset 0 0 0 1px var(--border-strong)" }}
                      />
                      <span className="truncate font-medium">{ent?.name ?? r.entitlement_id}</span>
                      <IdTag>{r.entitlement_id}</IdTag>
                    </div>
                  </TD>
                  <TD>
                    {!ent ? (
                      <Badge>Deleted</Badge>
                    ) : ent.type === "usage" ? (
                      <Badge color="blue">Usage</Badge>
                    ) : (
                      <Badge color="brand">Feature flag</Badge>
                    )}
                  </TD>
                  <TD align="right" className="font-medium">
                    {r.calls ? formatNumber(r.total_amount) : <EmptyCell />}
                  </TD>
                  <TD align="right">{r.calls ? formatNumber(r.calls) : <EmptyCell />}</TD>
                  <TD align="right" className="text-fg-secondary">
                    {r.calls ? decimal.format(r.total_amount / r.calls) : <EmptyCell />}
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-muted">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${ratio > 0 ? Math.max(ratio * 100, 2) : 0}%` }}
                        />
                      </div>
                      <span className="w-9 text-right text-fg-secondary tabular">{r.calls ? formatShare(ratio) : "—"}</span>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

function TopAccounts({
  appId,
  rows,
  loading,
  error,
  description,
  emptyText,
}: {
  appId: string;
  rows: TopAccountUsage[] | undefined;
  loading: boolean;
  error: Error | null;
  description: string;
  emptyText: string;
}) {
  const router = useRouter();
  const [limit, setLimit] = useState(10);
  const visible = useMemo(() => rows?.slice(0, limit) ?? [], [rows, limit]);
  const ids = useMemo(() => visible.map((r) => r.namespace_id), [visible]);
  // Resolve each id on its own (the legacy screen only knew the first 20 accounts).
  const { names, pending } = useAccountNames(appId, ids);
  const total = rows?.length ?? 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Top accounts"
        description={rows?.length ? `${description} · Ranked by ${rankedBy(rows) === "calls" ? "calls" : "usage"}` : description}
      />
      {loading ? (
        <div className="flex flex-col gap-2 p-6">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : error ? (
        <div className="p-5">
          <Note icon={<TriangleAlert />}>Top accounts couldn&apos;t be loaded: {error.message}</Note>
        </div>
      ) : !visible.length ? (
        <EmptyState compact icon={<Trophy />} title="No active accounts" description={emptyText} />
      ) : (
        <>
          <TableContainer className={cn(total <= 10 && "[&_tbody_tr:last-child>td]:border-b-0")}>
            <Table>
              <THead>
                <tr>
                  <TH align="right" className="w-12">
                    #
                  </TH>
                  <TH icon={<Users />}>Account</TH>
                  <TH icon={<Sigma />} align="right" className="w-40">
                    Usage
                  </TH>
                  <TH icon={<Activity />} align="right" className="w-40">
                    Calls
                  </TH>
                </tr>
              </THead>
              <TBody>
                {visible.map((r, i) => {
                  const name = names.get(r.namespace_id);
                  const href = `/apps/${appId}/accounts/${encodeURIComponent(r.namespace_id)}`;
                  return (
                    <TR key={r.namespace_id} interactive onClick={() => router.push(href)}>
                      <TD align="right" className="text-fg-tertiary">
                        {i + 1}
                      </TD>
                      <TD>
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar name={name ?? r.namespace_id} seed={r.namespace_id} />
                          {pending.has(r.namespace_id) ? (
                            <Skeleton className="h-4 w-32" />
                          ) : (
                            <Link
                              href={href}
                              onClick={(e) => e.stopPropagation()}
                              className="truncate font-medium hover:underline"
                            >
                              {name ?? r.namespace_id}
                            </Link>
                          )}
                          {name && name !== r.namespace_id ? <IdTag>{r.namespace_id}</IdTag> : null}
                        </div>
                      </TD>
                      <TD align="right" className="font-medium">
                        {formatNumber(r.total_amount)}
                      </TD>
                      <TD align="right" className="text-fg-secondary">
                        {formatNumber(r.calls)}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
          {total > 10 ? (
            <TableFooter className="justify-between border-b-0">
              <span>
                Top {visible.length} of {total >= TOP_LIMIT ? `${TOP_LIMIT}+` : formatNumber(total)} active accounts
              </span>
              <Button variant="ghost" size="xs" onClick={() => setLimit(limit === 10 ? 25 : 10)}>
                {limit === 10 ? "Show 25" : "Show 10"}
              </Button>
            </TableFooter>
          ) : null}
        </>
      )}
    </Card>
  );
}
