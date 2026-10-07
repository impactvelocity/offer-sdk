"use client";

import {
  CircleDollarSign,
  DoorOpen,
  HeartHandshake,
  Layers,
  ListChecks,
  Pause,
  Pencil,
  Power,
  Sparkles,
  Tag,
  TrendingDown,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { PanelSection, RecordHeader, RecordIcon, RecordLayout } from "@/components/catalog/record";
import { PageHeader } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { CodeBlock } from "@/components/ui/code-block";
import { EmptyState } from "@/components/ui/empty-state";
import { Property, PropertyList } from "@/components/ui/property-list";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyCell, Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api/client";
import { keys, useApiMutation, useAppId, useCancelFlow, useCancelFlowStats, useCancelFlows, useCancelSessions, useIncentives, usePlans, useWorkspace } from "@/lib/api/hooks";
import type { CancelFlow, CancelFlowStep } from "@/lib/api/types";
import { formatCurrency, formatNumber, formatRelative, pluralize } from "@/lib/utils";
import { StatStrip } from "@/app/(protected)/(workspace)/apps/[appId]/stat-strip";
import { KIND_LABELS, OUTCOMES, percent, specSummary } from "./format";

/** The app's cancel flow: how it's doing, why people leave, and how to add it. */
export function CancelFlowView() {
  const appId = useAppId();
  const router = useRouter();
  const { data: flows, isLoading, error } = useCancelFlows(appId);
  const create = useApiMutation(() => api.cancelFlows.create(appId), {
    success: "Cancel flow created from the template",
    invalidate: [keys.cancelFlows(appId)],
    onSuccess: () => router.push(`/apps/${appId}/cancel-flow/edit`),
  });

  const header = <PageHeader icon={<DoorOpen />} title="Cancel flow" />;
  if (isLoading) {
    return (
      <>
        {header}
        <div className="flex flex-col gap-3 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48" />
        </div>
      </>
    );
  }
  if (error) return <>{header}<EmptyState icon={<DoorOpen />} title="Couldn't load the cancel flow" description={error.message} /></>;
  if (flows === null) {
    return (
      <>
        {header}
        <EmptyState
          icon={<DoorOpen />}
          title="Cancel flows need the Offer API"
          description="The in-memory mock doesn't run cancel flows. Point OFFER_API_URL at the Offer API to set one up."
        />
      </>
    );
  }
  const flow = flows?.find((f) => f.id === "default") ?? flows?.[0];
  if (!flow) {
    return (
      <>
        {header}
        <EmptyState
          icon={<HeartHandshake />}
          title="Keep more of the customers who cancel"
          description="Put a cancel button in your app that asks why, makes a save offer (a discount, a pause, a cheaper plan or a bonus) and only then cancels. Start from a template and edit the questions and offers here, with no code changes."
          action={
            <Button variant="primary" loading={create.isPending} onClick={() => create.mutate()}>
              Create cancel flow
            </Button>
          }
        />
      </>
    );
  }
  return <FlowOverview appId={appId} flow={flow} />;
}

function FlowOverview({ appId, flow: listed }: { appId: string; flow: CancelFlow }) {
  const router = useRouter();
  // The single-flow read also says what the API can do (Claude, Render Workflows).
  const { data: detail } = useCancelFlow(appId, listed.id);
  const flow = detail ?? listed;
  const { data: stats } = useCancelFlowStats(appId, flow.id);
  const sessions = useCancelSessions(appId, { flow: flow.id, limit: 25 });
  const toggle = useApiMutation(
    () => api.cancelFlows.update(appId, flow.id, { status: flow.status === "active" ? "draft" : "active" }),
    {
      success: (f) => (f.status === "active" ? "Cancel flow is live" : "Cancel flow turned off"),
      invalidate: [keys.cancelFlows(appId)],
    },
  );
  const offerStep = flow.steps.find((s) => s.type === "offer");
  const dynamic = offerStep?.type === "offer" && offerStep.dynamic;
  const money = (n: number) => formatCurrency(n, "USD");
  const live = flow.status === "active";

  return (
    <>
      <PageHeader
        icon={<DoorOpen />}
        title="Cancel flow"
        actions={
          <>
            <Link href={`/apps/${appId}/cancel-flow/edit`} className={buttonVariants()}>
              <Pencil />
              Edit flow
            </Link>
            <Button variant={live ? "secondary" : "primary"} loading={toggle.isPending} onClick={() => toggle.mutate()}>
              <Power />
              {live ? "Turn off" : "Turn on"}
            </Button>
          </>
        }
      />
      <RecordLayout
        main={
          <>
            <RecordHeader
              icon={
                <RecordIcon tone="pink">
                  <HeartHandshake />
                </RecordIcon>
              }
              title={flow.name}
              badges={
                <>
                  <Badge color={live ? "green" : "gray"} dot>
                    {live ? "Live" : "Off"}
                  </Badge>
                  {dynamic ? <Badge color="brand">Dynamic offers</Badge> : null}
                </>
              }
              subtitle={`${pluralize(flow.steps.length, "step")} · last 30 days`}
            />
            {!live ? (
              <Callout tone="info" className="mx-8 mb-4" action={<Button size="sm" onClick={() => toggle.mutate()}>Turn on</Button>}>
                The flow is off: the SDK&apos;s cancel button can&apos;t open it yet. You can still preview it in the editor.
              </Callout>
            ) : null}
            <div className="flex flex-col gap-8 px-8 pb-10">
              <StatStrip
                stats={[
                  { label: "Cancel attempts", icon: <DoorOpen />, value: stats ? formatNumber(stats.started) : undefined, hint: stats ? `${formatNumber(stats.abandoned)} closed the flow` : undefined },
                  { label: "Saved", icon: <HeartHandshake />, value: stats ? formatNumber(stats.saved) : undefined, hint: stats ? `${formatNumber(stats.cancelled)} cancelled` : undefined },
                  { label: "Save rate", icon: <TrendingDown />, value: stats ? percent(stats.save_rate) : undefined, hint: "Of those who decided" },
                  {
                    label: "Monthly revenue kept",
                    icon: <CircleDollarSign />,
                    value: stats ? money(stats.monthly_revenue_saved) : undefined,
                    hint: stats ? `${money(stats.monthly_revenue_lost)} lost` : undefined,
                  },
                ]}
              />

              <div className="grid gap-8 2xl:grid-cols-2">
                <StatsTable
                  title="Why customers leave"
                  empty="Answers show up here once customers start the flow."
                  head={["Answer", "Picked", "Saved", "Cancelled", "Save rate"]}
                  rows={(stats?.reasons ?? []).map((r) => [
                    <span key="l" className="flex flex-col">
                      {r.label}
                      <span className="text-xs font-normal text-fg-tertiary">{r.step_title}</span>
                    </span>,
                    formatNumber(r.count),
                    formatNumber(r.saved),
                    formatNumber(r.cancelled),
                    percent(r.saved + r.cancelled ? r.saved / (r.saved + r.cancelled) : null),
                  ])}
                />
                <StatsTable
                  title="Save offers"
                  empty="No offers shown yet."
                  head={["Offer", "Shown", "Accepted", "Take rate"]}
                  rows={(stats?.offers ?? []).map((o) => [
                    <span key="k" className="flex items-center gap-2">
                      {KIND_LABELS[o.kind]}
                      {o.source === "dynamic" ? <Badge color="brand">Claude</Badge> : null}
                    </span>,
                    formatNumber(o.shown),
                    formatNumber(o.accepted),
                    percent(o.shown ? o.accepted / o.shown : null),
                  ])}
                />
              </div>

              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-fg">Recent attempts</h3>
                <div className="overflow-hidden rounded-lg border border-border">
                  <TableContainer>
                    <Table>
                      <THead>
                        <tr>
                          <TH icon={<Users />}>Account</TH>
                          <TH icon={<ListChecks />}>Reason</TH>
                          <TH icon={<HeartHandshake />}>Offer</TH>
                          <TH icon={<Tag />}>Outcome</TH>
                          <TH align="right">When</TH>
                        </tr>
                      </THead>
                      <TBody>
                        {sessions.isLoading ? (
                          <TR>
                            <TD colSpan={5}>
                              <Skeleton className="h-6" />
                            </TD>
                          </TR>
                        ) : !sessions.data?.length ? (
                          <TR>
                            <TD colSpan={5} className="py-6 text-center text-fg-tertiary">
                              No one has opened the flow yet.
                            </TD>
                          </TR>
                        ) : (
                          sessions.data.map((s) => {
                            const outcome = OUTCOMES[s.status];
                            const reason = s.answers.find((a) => a.label)?.label;
                            return (
                              <TR key={s.id} interactive onClick={() => router.push(`/apps/${appId}/accounts/${encodeURIComponent(s.account_id)}`)}>
                                <TD>
                                  <span className="flex flex-col">
                                    <span className="font-medium">{s.account.name ?? s.account_id}</span>
                                    <span className="text-xs text-fg-tertiary">
                                      {s.account.plan_name}
                                      {s.account.monthly_value ? ` · ${money(s.account.monthly_value)}/mo` : ""}
                                    </span>
                                  </span>
                                </TD>
                                <TD className="max-w-64">
                                  {reason ? <span className="truncate">{reason}</span> : <EmptyCell />}
                                  {s.answers.find((a) => a.text)?.text ? (
                                    <span className="block truncate text-xs text-fg-tertiary">“{s.answers.find((a) => a.text)?.text}”</span>
                                  ) : null}
                                </TD>
                                <TD>
                                  {s.offer ? (
                                    <span className="flex items-center gap-1.5" title={s.offer.reasoning ?? undefined}>
                                      {KIND_LABELS[s.offer.kind]}
                                      {s.offer.source === "dynamic" ? <Sparkles className="size-3.5 text-accent-fg" /> : null}
                                      <span className="text-xs text-fg-tertiary">{s.offer.status}</span>
                                    </span>
                                  ) : (
                                    <EmptyCell />
                                  )}
                                </TD>
                                <TD>
                                  <Badge color={outcome.color} dot>
                                    {outcome.label}
                                  </Badge>
                                </TD>
                                <TD align="right" className="whitespace-nowrap text-fg-secondary">
                                  {formatRelative(s.created_at)}
                                </TD>
                              </TR>
                            );
                          })
                        )}
                      </TBody>
                    </Table>
                  </TableContainer>
                </div>
              </section>
            </div>
          </>
        }
        panel={
          <>
            <PanelSection title="Details">
              <PropertyList>
                <Property icon={<Power />} label="Status">
                  <Badge color={live ? "green" : "gray"} dot>
                    {live ? "Live" : "Off"}
                  </Badge>
                </Property>
                <Property icon={<Sparkles />} label="Dynamic offers">
                  {dynamic ? (flow.capabilities?.dynamic_offers === false ? "On, but the API has no ANTHROPIC_API_KEY" : "On") : "Off"}
                </Property>
                <Property icon={<Pause />} label="Pauses run on">
                  {flow.capabilities?.pause_workflows ? "Render Workflows" : "The API"}
                </Property>
              </PropertyList>
            </PanelSection>
            <PanelSection
              title="Flow"
              actions={
                <Link href={`/apps/${appId}/cancel-flow/edit`} className={buttonVariants({ size: "xs", variant: "ghost" })}>
                  Edit
                </Link>
              }
            >
              <FlowOutline appId={appId} steps={flow.steps} />
            </PanelSection>
            <PanelSection title="Add it to your app">
              <Integration appId={appId} />
            </PanelSection>
          </>
        }
      />
    </>
  );
}

function FlowOutline({ appId, steps }: { appId: string; steps: CancelFlowStep[] }) {
  const { data: plans = [] } = usePlans(appId);
  const { data: incentives = [] } = useIncentives(appId);
  const names = {
    plan: (id: string) => plans.find((p) => p.id === id)?.name ?? id,
    incentive: (id: string) => incentives.find((i) => i.id === id)?.name ?? id,
  };
  const offer = steps.find((s) => s.type === "offer");
  return (
    <ol className="flex flex-col gap-3 text-sm">
      {steps.map((s, i) => (
        <li key={s.id} className="flex gap-2.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-bg-muted text-xs text-fg-secondary">{i + 1}</span>
          <div className="min-w-0 flex-1">
            {s.type === "question" ? (
              <>
                <div className="font-medium text-fg">{s.title}</div>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs text-fg-tertiary">
                  {s.answers.map((a) => {
                    const spec = offer?.type === "offer" ? offer.by_answer[a.id] : null;
                    return (
                      <li key={a.id} className="flex justify-between gap-2">
                        <span className="truncate">{a.label}</span>
                        {spec ? <span className="shrink-0 text-fg-secondary">{specSummary(spec, names)}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : s.type === "text" ? (
              <div className="font-medium text-fg">{s.title}</div>
            ) : s.type === "offer" ? (
              <>
                <div className="font-medium text-fg">Save offer</div>
                <div className="text-xs text-fg-tertiary">
                  {s.dynamic ? `Claude picks from ${s.guardrails.kinds.map((k) => KIND_LABELS[k].toLowerCase()).join(", ")}` : "Fixed per answer"}
                  {s.default ? ` · otherwise ${specSummary(s.default, names).toLowerCase()}` : ""}
                </div>
              </>
            ) : (
              <>
                <div className="font-medium text-fg">{s.title}</div>
                <div className="text-xs text-fg-tertiary">Cancels the subscription</div>
              </>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Integration({ appId }: { appId: string }) {
  const { data: workspace } = useWorkspace();
  const apiUrl = workspace?.apiBaseUrl ?? "https://api.example.com";
  const server = `// Your server, with your secret key: a token for the signed-in user only.
const res = await fetch(\`${apiUrl}/apps/${appId}/namespaces/\${userId}/token\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.OFFER_SECRET_KEY}\` },
});
const { token } = await res.json();`;
  const client = `import { CancelFlow, CancelFlowProvider } from "@/sdk/cancel"; // offer-app/src/sdk/cancel

<CancelFlowProvider apiUrl="${apiUrl}" appId="${appId}" token={token}>
  <CancelFlow.Trigger>Cancel subscription</CancelFlow.Trigger>
  <CancelFlow.Dialog />
</CancelFlowProvider>`;
  return (
    <div className="flex flex-col gap-3 text-sm text-fg-tertiary">
      <p>Mint a short-lived account token on your server, then render the button. Questions and offers come from here.</p>
      <CodeBlock code={server} lang="ts" />
      <CodeBlock code={client} lang="tsx" />
      <p className="text-xs">
        PayPal subscriptions are cancelled, paused or repriced for you. For other billing, handle the <code>cancel_flow.cancelled</code>{" "}
        webhook.
      </p>
    </div>
  );
}

function StatsTable({ title, head, rows, empty }: { title: string; head: string[]; rows: ReactNode[][]; empty: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <div className="overflow-hidden rounded-lg border border-border">
        <TableContainer>
          <Table>
            <THead>
              <tr>
                {head.map((h, i) => (
                  <TH key={h} align={i === 0 ? "left" : "right"} icon={i === 0 ? <Layers /> : undefined}>
                    {h}
                  </TH>
                ))}
              </tr>
            </THead>
            <TBody>
              {rows.length ? (
                rows.map((cells, r) => (
                  <TR key={r}>
                    {cells.map((cell, i) => (
                      <TD key={i} align={i === 0 ? "left" : "right"} className={i === 0 ? "font-medium" : "tabular"}>
                        {cell}
                      </TD>
                    ))}
                  </TR>
                ))
              ) : (
                <TR>
                  <TD colSpan={head.length} className="py-6 text-center text-fg-tertiary">
                    {empty}
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </TableContainer>
      </div>
    </section>
  );
}
