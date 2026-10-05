"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  BadgePercent,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  Copy,
  CreditCard,
  Ellipsis,
  ExternalLink,
  Eye,
  Hash,
  Layers,
  Link2,
  Pencil,
  Repeat,
  Rocket,
  SearchX,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { LinkedAccounts } from "@/components/catalog/linked-accounts";
import { PanelSection, RecordHeader, RecordIcon, RecordLayout } from "@/components/catalog/record";
import { discountSummary, extrasForLabel, INTERVAL_NAMES, offerLink, offerState } from "@/components/offers/format";
import { OfferPreview } from "@/components/offers/offer-preview";
import { PaypalCallout } from "@/components/offers/paypal-callout";
import { useOfferActions } from "@/components/offers/use-offer-actions";
import { PageHeader } from "@/components/shell/page";
import { Badge, Chip, IdTag } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Property, PropertyList } from "@/components/ui/property-list";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyCell, Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tab, Tabs, TabsList, TabsPanel } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { useAccounts, useApp, useAppId, useOffer, useOfferCheckouts, useOfferStats, usePlans } from "@/lib/api/hooks";
import type { Offer, OfferCheckout } from "@/lib/api/types";
import { formatCurrency, formatDate, formatDateTime, formatNumber, pluralize } from "@/lib/utils";
import { StatStrip } from "../../stat-strip";

const PER_PAGE = 20;

export function OfferDetail({ offerId }: { offerId: string }) {
  const appId = useAppId();
  const router = useRouter();
  const { data: offer, isLoading, error } = useOffer(appId, offerId);
  const { data: plans = [] } = usePlans(appId);
  const { data: app } = useApp(appId);
  const actions = useOfferActions(appId, { onDeleted: () => router.push(`/apps/${appId}/offers`) });
  const [page, setPage] = useState(1);
  const accounts = useAccounts(appId, { offer: offerId, page, perPage: PER_PAGE });
  const planName = useMemo(() => new Map(plans.map((p) => [p.id, p.name])), [plans]);

  const crumbs = [{ label: "Offers", href: `/apps/${appId}/offers`, icon: <BadgePercent /> }];

  if (error && !offer) {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Not found" />
        <EmptyState
          icon={<SearchX />}
          title="Offer not found"
          description={`There's no offer with the ID “${offerId}” in this app.`}
          action={
            <Link href={`/apps/${appId}/offers`} className={buttonVariants({ variant: "primary" })}>
              All offers
            </Link>
          }
        />
      </>
    );
  }

  if (isLoading || !offer) {
    return (
      <>
        <PageHeader crumbs={crumbs} title={<Skeleton className="h-4 w-24" />} />
        <div className="flex flex-col gap-3 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48" />
        </div>
      </>
    );
  }

  const state = offerState(offer);
  const editHref = `/apps/${appId}/offers/${encodeURIComponent(offer.id)}/edit`;
  const copyLink = () => {
    if (!app) return;
    void navigator.clipboard.writeText(offerLink(app, offer.id, undefined, window.location.origin));
    toast.success("Checkout link copied");
  };

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={offer.name}
        actions={
          <>
            <Link href={editHref} className={buttonVariants()}>
              <Pencil />
              Edit
            </Link>
            {offer.status === "active" ? (
              <Button onClick={() => actions.archive(offer)}>
                <Archive />
                Archive
              </Button>
            ) : (
              <Button variant="primary" loading={actions.publish.isPending} onClick={() => actions.publish.mutate(offer)}>
                <Rocket />
                {offer.status === "archived" ? "Publish again" : "Publish"}
              </Button>
            )}
            <Menu>
              <MenuTrigger aria-label="More actions" className={buttonVariants({ icon: true })}>
                <Ellipsis />
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem onClick={copyLink}>
                  <Link2 />
                  Copy checkout link
                </MenuItem>
                <MenuItem onClick={() => router.push(`/apps/${appId}/offers/new?from=${encodeURIComponent(offer.id)}`)}>
                  <Copy />
                  Duplicate
                </MenuItem>
                <MenuItem onClick={() => navigator.clipboard.writeText(offer.id)}>
                  <Hash />
                  Copy offer ID
                </MenuItem>
                <MenuSeparator />
                <MenuItem tone="danger" onClick={() => actions.remove(offer)}>
                  <Trash2 />
                  Delete offer
                </MenuItem>
              </MenuContent>
            </Menu>
          </>
        }
      />
      <RecordLayout
        main={
          <>
            <RecordHeader
              icon={
                <RecordIcon tone="pink">
                  <BadgePercent />
                </RecordIcon>
              }
              title={offer.name}
              badges={
                <Badge color={state.color} dot>
                  {state.label}
                </Badge>
              }
              subtitle={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <IdTag>{offer.id}</IdTag>
                  <span>·</span>
                  <span>{discountSummary(offer)}</span>
                  <span>·</span>
                  <span>{pluralize(offer.plans.length, "plan")}</span>
                </span>
              }
            />
            <PaypalCallout appId={appId} className="mx-8 mb-4" />
            <Tabs defaultValue="performance" className="flex flex-1 flex-col">
              <TabsList>
                <Tab value="performance" icon={<ChartColumn />}>
                  Performance
                </Tab>
                <Tab value="checkout" icon={<Eye />}>
                  Checkout
                </Tab>
                <Tab value="accounts" icon={<Users />} count={accounts.data ? accounts.data.total : null}>
                  Accounts
                </Tab>
                <Tab value="checkouts" icon={<ShoppingCart />}>
                  Checkouts
                </Tab>
              </TabsList>
              <TabsPanel value="performance" className="flex flex-col gap-6 px-8 py-6">
                <Performance appId={appId} offer={offer} planName={planName} />
              </TabsPanel>
              <TabsPanel value="checkout" className="px-8 py-6">
                <CheckoutTab appId={appId} offer={offer} />
              </TabsPanel>
              <TabsPanel value="accounts">
                <LinkedAccounts
                  appId={appId}
                  rows={accounts.data?.data}
                  total={accounts.data?.total ?? 0}
                  page={page}
                  perPage={PER_PAGE}
                  onPageChange={setPage}
                  loading={accounts.isLoading}
                  emptyTitle="No one is on this offer yet"
                  emptyDescription="Accounts appear here once they buy through it and while their subscription is active."
                  extraColumn={{
                    header: "Plan",
                    cell: (row) => {
                      const plan = accounts.data?.data.find((a) => a.id === row.id)?.plan;
                      return plan ? <Chip icon={<Layers />}>{planName.get(plan) ?? plan}</Chip> : null;
                    },
                  }}
                />
              </TabsPanel>
              <TabsPanel value="checkouts">
                <Checkouts appId={appId} offerId={offer.id} planName={planName} />
              </TabsPanel>
            </Tabs>
          </>
        }
        panel={
          <>
            <PanelSection title="Details">
              <PropertyList>
                <Property icon={<Tag />} label="Status">
                  <Badge color={state.color} dot>
                    {state.label}
                  </Badge>
                </Property>
                <Property icon={<Hash />} label="Offer ID">
                  <span className="flex items-center gap-1">
                    <code className="truncate text-xs">{offer.id}</code>
                    <CopyButton value={offer.id} label="Copy ID" />
                  </span>
                </Property>
                <Property icon={<BadgePercent />} label="Deal">
                  {discountSummary(offer)}
                </Property>
                <Property icon={<Repeat />} label="Billing">
                  {offer.intervals.map((i) => INTERVAL_NAMES[i]).join(", ")}
                </Property>
                <Property icon={<ShoppingBag />} label="Sales">
                  {formatNumber(offer.redemptions ?? 0)}
                  {offer.max_redemptions ? ` of ${formatNumber(offer.max_redemptions)}` : ""}
                </Property>
                <Property icon={<CalendarClock />} label="Ends">
                  {offer.expires_at ? formatDateTime(offer.expires_at) : "No end date"}
                </Property>
                <Property icon={<Sparkles />} label="Source">
                  {offer.type === "targeted" ? `Targeted at ${offer.account_id}` : offer.source.replace("_", " ")}
                </Property>
                <Property icon={<CalendarDays />} label="Published">
                  {offer.published_at ? formatDate(offer.published_at) : "Not yet"}
                </Property>
              </PropertyList>
            </PanelSection>
            <PanelSection title="Share">
              <ShareLink appId={appId} offer={offer} />
            </PanelSection>
            <PanelSection title="Plans">
              <div className="flex flex-col gap-2">
                {offer.plans.map((p) => (
                  <div key={p.plan_id} className="flex flex-col gap-1">
                    <Chip icon={<Layers />} className="self-start">
                      {planName.get(p.plan_id) ?? p.plan_id}
                    </Chip>
                    {p.entitlements.length ? (
                      <span className="pl-1 text-xs text-fg-tertiary">
                        {pluralize(p.entitlements.length, "extra")} · {extrasForLabel(p.extras_for).toLowerCase()}
                      </span>
                    ) : null}
                  </div>
                ))}
                {offer.bumps.length ? (
                  <span className="pt-1 text-xs text-fg-tertiary">
                    Bumps: {offer.bumps.map((b) => `${b.label} (${formatCurrency(b.price.amount, offer.currency)})`).join(", ")}
                  </span>
                ) : null}
              </div>
            </PanelSection>
          </>
        }
      />
    </>
  );
}

function Performance({ appId, offer, planName }: { appId: string; offer: Offer; planName: Map<string, string> }) {
  const { data: stats } = useOfferStats(appId, offer.id);
  const money = (n: number) => formatCurrency(n, offer.currency);
  return (
    <>
      <StatStrip
        stats={[
          { label: "Views", icon: <Eye />, value: stats ? formatNumber(stats.views) : undefined },
          { label: "Checkouts", icon: <ShoppingCart />, value: stats ? formatNumber(stats.checkouts) : undefined },
          {
            label: "Sales",
            icon: <ShoppingBag />,
            value: stats ? formatNumber(stats.completed) : undefined,
            hint: stats?.conversion !== null && stats?.conversion !== undefined ? `${(stats.conversion * 100).toFixed(1)}% of views` : undefined,
          },
          { label: "Revenue", icon: <CreditCard />, value: stats ? money(stats.revenue) : undefined, hint: "First payments and bumps" },
        ]}
      />
      {stats && stats.checkouts === 0 ? (
        <p className="text-sm text-fg-tertiary">No checkouts yet. Share the link from the panel on the right.</p>
      ) : null}
      {stats?.by_plan.length ? (
        <StatsTable
          title="By plan"
          head={["Plan", "Billing", "Started", "Sales", "Revenue"]}
          rows={stats.by_plan.map((r) => [
            planName.get(r.plan_id) ?? r.plan_id,
            INTERVAL_NAMES[r.interval],
            formatNumber(r.checkouts),
            formatNumber(r.completed),
            money(r.revenue),
          ])}
        />
      ) : null}
      {stats?.by_ref.length ? (
        <StatsTable
          title="By source"
          description="The ?ref= on the checkout link: affiliates, campaigns, upgrade links."
          head={["Source", "Started", "Sales", "Revenue"]}
          rows={stats.by_ref.map((r) => [r.ref ?? <EmptyCell>Direct</EmptyCell>, formatNumber(r.checkouts), formatNumber(r.completed), money(r.revenue)])}
        />
      ) : null}
      {offer.bumps.length && stats?.completed ? (
        <StatsTable
          title="Order bumps"
          head={["Bump", "Taken", "Take rate"]}
          rows={offer.bumps.map((b) => {
            const row = stats.bumps.find((x) => x.id === b.id);
            return [b.label, formatNumber(row?.taken ?? 0), `${Math.round((row?.rate ?? 0) * 100)}%`];
          })}
        />
      ) : null}
    </>
  );
}

function StatsTable({ title, description, head, rows }: { title: string; description?: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {description ? <p className="text-xs text-fg-tertiary">{description}</p> : null}
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <TableContainer>
          <Table>
            <THead>
              <tr>
                {head.map((h, i) => (
                  <TH key={h} align={i === 0 ? "left" : "right"}>
                    {h}
                  </TH>
                ))}
              </tr>
            </THead>
            <TBody>
              {rows.map((cells, r) => (
                <TR key={r}>
                  {cells.map((cell, i) => (
                    <TD key={i} align={i === 0 ? "left" : "right"} className={i === 0 ? "font-medium" : "tabular"}>
                      {cell}
                    </TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      </div>
    </section>
  );
}

function CheckoutTab({ appId, offer }: { appId: string; offer: Offer }) {
  // The saved offer, priced the way its checkout page shows it.
  const preview = useQuery({
    queryKey: ["app", appId, "offers", offer.id, "preview", offer],
    queryFn: () => api.offers.previewDraft(appId, offer),
  });
  return (
    <div className="grid max-w-[880px] gap-8 lg:grid-cols-[400px_minmax(0,1fr)]">
      {preview.data ? (
        <OfferPreview offer={preview.data} />
      ) : preview.error ? (
        <p className="text-sm text-danger-fg">{preview.error.message}</p>
      ) : (
        <Skeleton className="h-80" />
      )}
      <div className="flex flex-col gap-3 text-sm text-fg-secondary">
        <h3 className="text-sm font-semibold text-fg">How buyers see it</h3>
        <p>
          This is the checkout page built from the SDK&apos;s <code>&lt;OfferProvider&gt;</code> components with this offer&apos;s
          prices. Your page renders the same data with your own design.
        </p>
        <p>
          Buying sets the account&apos;s plan, records the offer on it and adds its extras. When the discount ends PayPal
          bills the list price automatically.
        </p>
      </div>
    </div>
  );
}

const CHECKOUT_STATUS: Record<OfferCheckout["status"], { label: string; color: "green" | "gray" | "red" | "yellow" }> = {
  created: { label: "Started", color: "yellow" },
  completed: { label: "Paid", color: "green" },
  expired: { label: "Expired", color: "gray" },
  failed: { label: "Failed", color: "red" },
  cancelled: { label: "Cancelled", color: "gray" },
};

function Checkouts({ appId, offerId, planName }: { appId: string; offerId: string; planName: Map<string, string> }) {
  const router = useRouter();
  const { data, isLoading } = useOfferCheckouts(appId, offerId);
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  }
  if (!data?.length) {
    return <EmptyState compact icon={<ShoppingCart />} title="No checkouts yet" description="Every checkout started from this offer shows up here." />;
  }
  return (
    <TableContainer>
      <Table>
        <THead>
          <tr>
            <TH icon={<CalendarDays />}>Started</TH>
            <TH icon={<Users />}>Buyer</TH>
            <TH icon={<Layers />}>Plan</TH>
            <TH icon={<Link2 />}>Source</TH>
            <TH icon={<CreditCard />} align="right">
              Today
            </TH>
            <TH icon={<Tag />}>Status</TH>
          </tr>
        </THead>
        <TBody>
          {data.map((c) => {
            const status = CHECKOUT_STATUS[c.status];
            return (
              <TR
                key={c.id}
                interactive={!!c.account_id}
                onClick={() => c.account_id && router.push(`/apps/${appId}/accounts/${encodeURIComponent(c.account_id)}`)}
              >
                <TD className="text-fg-secondary">{formatDateTime(c.created_at)}</TD>
                <TD>{c.account_id ? <IdTag>{c.account_id}</IdTag> : (c.email ?? <EmptyCell />)}</TD>
                <TD>
                  {planName.get(c.plan_id) ?? c.plan_id} · {INTERVAL_NAMES[c.interval]}
                  {c.bumps.length ? <span className="text-fg-tertiary"> + {pluralize(c.bumps.length, "bump")}</span> : null}
                </TD>
                <TD className="text-fg-secondary">{c.ref ?? <EmptyCell />}</TD>
                <TD align="right" className="tabular">
                  {formatCurrency(c.total_today, c.currency)}
                </TD>
                <TD>
                  <Badge color={status.color} dot>
                    {status.label}
                  </Badge>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableContainer>
  );
}

/** Builds a checkout link with an optional ?ref= for affiliates and campaigns. */
function ShareLink({ appId, offer }: { appId: string; offer: Offer }) {
  const { data: app } = useApp(appId);
  const [ref, setRef] = useState("");
  if (!app) return <Skeleton className="h-16" />;
  const url = offerLink(app, offer.id, ref, typeof window === "undefined" ? "" : window.location.origin);
  return (
    <div className="flex flex-col gap-2">
      <Input size="sm" placeholder="ref (optional), e.g. partner_x" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Ref" />
      <div className="flex items-center gap-1 rounded-md border border-border bg-bg-subtle px-2 py-1.5">
        <code className="min-w-0 flex-1 truncate text-xs text-fg-secondary">{url}</code>
        <CopyButton value={url} label="Copy link" />
        <a href={url} target="_blank" rel="noreferrer" aria-label="Open checkout" className={buttonVariants({ variant: "ghost", size: "xs", icon: true })}>
          <ExternalLink />
        </a>
      </div>
      <p className="text-xs text-fg-tertiary">
        {app.checkout_url ? (
          <>Points at your checkout page.</>
        ) : (
          <>
            Points at the demo checkout. Set your own page in{" "}
            <Link href={`/apps/${appId}/settings#payments`} className="text-accent-fg hover:underline">
              App settings
            </Link>
            .
          </>
        )}
      </p>
    </div>
  );
}
