"use client";

import {
  Braces,
  CalendarDays,
  Copy,
  DollarSign,
  Ellipsis,
  ExternalLink,
  FileText,
  Hash,
  KeyRound,
  Layers,
  SearchX,
  StickyNote,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AddonsEditor, EntitlementsEditor } from "@/components/catalog/attachments";
import { PlanDialog } from "@/components/catalog/dialogs";
import { formatPrice } from "@/components/catalog/format";
import { InlineEdit } from "@/components/catalog/inline-edit";
import { LinkedAccounts } from "@/components/catalog/linked-accounts";
import { MetaEditor } from "@/components/catalog/meta-editor";
import { PricingEditor } from "@/components/catalog/pricing-editor";
import { planLink } from "@/components/offers/format";
import { PanelSection, RecordHeader, RecordIcon, RecordLayout } from "@/components/catalog/record";
import { PageHeader } from "@/components/shell/page";
import { Badge, IdTag } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { useConfirm } from "@/components/ui/confirm";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Property, PropertyList } from "@/components/ui/property-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Tab, Tabs, TabsList, TabsPanel } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { useAddons, useApiMutation, useApp, useAppId, useEntitlements, usePlan, usePlanAccounts } from "@/lib/api/hooks";
import type { Entitlement, Plan } from "@/lib/api/types";
import { formatDate, pluralize } from "@/lib/utils";

const PER_PAGE = 20;

/** What GET /namespaces/:id/plan returns for a fresh account on this plan (before any usage). */
function sdkPreview(plan: Plan, entitlements: Entitlement[]) {
  const byId = new Map(entitlements.map((e) => [e.id, e]));
  const privateKeys = new Set(plan.privateMetaKeys ?? []);
  return {
    plan: {
      id: plan.id,
      name: plan.name,
      description: plan.description ?? null,
      isFree: plan.isFree ?? false,
      meta: Object.fromEntries(Object.entries(plan.meta ?? {}).filter(([k]) => !privateKeys.has(k))),
    },
    incentive: null,
    addons: plan.addons,
    entitlements: plan.entitlements.map((e) => {
      const max = e.max ?? null;
      return {
        id: e.id,
        feature: e.id,
        name: byId.get(e.id)?.name ?? e.id,
        type: byId.get(e.id)?.type ?? "usage",
        usage: 0,
        max,
        left: max,
        can: max === null || max > 0,
      };
    }),
  };
}

export function PlanDetail({ planId }: { planId: string }) {
  const appId = useAppId();
  const router = useRouter();
  const confirm = useConfirm();
  const { data: plan, isLoading, error } = usePlan(appId, planId);
  const { data: entitlements = [] } = useEntitlements(appId);
  const { data: addons = [] } = useAddons(appId);
  const [page, setPage] = useState(1);
  const accounts = usePlanAccounts(appId, planId, page, PER_PAGE);
  const [duplicating, setDuplicating] = useState(false);

  const update = useApiMutation((patch: Partial<Plan>) => api.plans.update(appId, planId, patch), { success: "Plan updated" });
  const remove = useApiMutation(() => api.plans.delete(appId, planId), {
    success: "Plan deleted",
    onSuccess: () => router.push(`/apps/${appId}/plans`),
  });

  const preview = useMemo(() => (plan ? JSON.stringify(sdkPreview(plan, entitlements), null, 2) : ""), [plan, entitlements]);
  const accountTotal = accounts.data?.total ?? 0;

  const onDelete = () =>
    plan &&
    confirm({
      title: `Delete ${plan.name}?`,
      description:
        accountTotal > 0
          ? `${pluralize(accountTotal, "account")} ${accountTotal === 1 ? "is" : "are"} on this plan. Their access checks will fail until you move them to another plan.`
          : "This can't be undone.",
      typeToConfirm: accountTotal > 0 ? plan.id : undefined,
      confirmLabel: "Delete Plan",
      onConfirm: () => remove.mutateAsync(),
    });

  const crumbs = [{ label: "Plans", href: `/apps/${appId}/plans`, icon: <Layers /> }];

  // Keep showing the last loaded plan if a refetch fails (e.g. right after deleting it).
  if (error && !plan) {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Not found" />
        <EmptyState
          icon={<SearchX />}
          title="Plan not found"
          description={`There's no plan with the ID “${planId}” in this app.`}
          action={
            <Link href={`/apps/${appId}/plans`} className={buttonVariants({ variant: "primary" })}>
              All Plans
            </Link>
          }
        />
      </>
    );
  }

  if (isLoading || !plan) {
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

  const price = formatPrice(plan.pricingCard, plan.isFree);
  const sellable = !plan.isFree && price !== null && price !== "Free";

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={plan.name}
        actions={
          <>
            <Button onClick={() => setDuplicating(true)}>
              <Copy />
              Duplicate
            </Button>
            <Menu>
              <MenuTrigger aria-label="More actions" className={buttonVariants({ icon: true })}>
                <Ellipsis />
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem onClick={() => navigator.clipboard.writeText(plan.id)}>
                  <Hash />
                  Copy plan ID
                </MenuItem>
                <MenuItem onClick={() => router.push(`/apps/${appId}/accounts?plan=${plan.id}`)}>
                  <Users />
                  View accounts
                </MenuItem>
                <MenuSeparator />
                <MenuItem tone="danger" onClick={onDelete}>
                  <Trash2 />
                  Delete plan
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
                <RecordIcon tone={plan.isFree ? "green" : "blue"}>
                  <Layers />
                </RecordIcon>
              }
              title={plan.name}
              badges={
                <>
                  {plan.isFree ? <Badge color="green">Free</Badge> : null}
                  {plan.pricingCard?.featured ? <Badge color="brand">Featured</Badge> : null}
                </>
              }
              subtitle={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <IdTag>{plan.id}</IdTag>
                  {price ? <span>{price}</span> : null}
                  <span>·</span>
                  <span>{pluralize(accountTotal, "account")}</span>
                </span>
              }
            />
            <Tabs defaultValue="access" className="flex flex-1 flex-col">
              <TabsList>
                <Tab value="access" icon={<KeyRound />} count={plan.entitlements.length + plan.addons.length}>
                  Access
                </Tab>
                <Tab value="pricing" icon={<DollarSign />}>
                  Pricing
                </Tab>
                <Tab value="meta" icon={<Braces />} count={Object.keys(plan.meta ?? {}).length || null}>
                  Metadata
                </Tab>
                <Tab value="accounts" icon={<Users />} count={accountTotal}>
                  Accounts
                </Tab>
              </TabsList>
              <TabsPanel value="access" className="flex flex-col gap-5 px-8 py-6">
                <EntitlementsEditor
                  appId={appId}
                  catalog={entitlements}
                  owner={{ kind: "plans", id: plan.id, name: plan.name, entitlements: plan.entitlements, addons: plan.addons }}
                />
                <AddonsEditor
                  appId={appId}
                  catalog={addons}
                  owner={{ kind: "plans", id: plan.id, name: plan.name, entitlements: plan.entitlements, addons: plan.addons }}
                />
              </TabsPanel>
              <TabsPanel value="pricing" className="px-8 py-6">
                <PricingEditor appId={appId} plan={plan} />
              </TabsPanel>
              <TabsPanel value="meta" className="px-8 py-6">
                <MetaEditor appId={appId} plan={plan} />
              </TabsPanel>
              <TabsPanel value="accounts">
                <LinkedAccounts
                  appId={appId}
                  rows={accounts.data?.data}
                  total={accountTotal}
                  page={page}
                  perPage={PER_PAGE}
                  onPageChange={setPage}
                  loading={accounts.isLoading}
                  emptyTitle="No accounts on this plan"
                  emptyDescription="Accounts are created by your app (or from the Accounts page) and assigned a plan."
                />
              </TabsPanel>
            </Tabs>
          </>
        }
        panel={
          <>
            <PanelSection title="Details">
              <PropertyList>
                <Property icon={<Tag />} label="Name">
                  <InlineEdit value={plan.name} required onSave={(name) => update.mutate({ name })} />
                </Property>
                <Property icon={<FileText />} label="Description">
                  <InlineEdit
                    value={plan.description}
                    multiline
                    placeholder="Add a description"
                    onSave={(description) => update.mutate({ description: description || null })}
                  />
                </Property>
                <Property icon={<Hash />} label="Plan ID">
                  <span className="flex items-center gap-1">
                    <code className="truncate text-xs">{plan.id}</code>
                    <CopyButton value={plan.id} label="Copy ID" />
                  </span>
                </Property>
                <Property icon={<CalendarDays />} label="Created">
                  {formatDate(plan.created_at)}
                </Property>
              </PropertyList>
            </PanelSection>
            {sellable ? (
              <PanelSection title="Checkout link">
                <CheckoutLink appId={appId} planId={plan.id} />
              </PanelSection>
            ) : null}
            <PanelSection title="Internal note">
              <div className="flex gap-2">
                <StickyNote className="mt-1.5 size-3.5 shrink-0 text-fg-tertiary" />
                <div className="min-w-0 flex-1">
                  <InlineEdit
                    value={plan.note}
                    multiline
                    placeholder="Add a note for your team"
                    onSave={(note) => update.mutate({ note: note || null })}
                  />
                </div>
              </div>
            </PanelSection>
            <PanelSection title="SDK response" actions={<Badge>Preview</Badge>}>
              <p className="mb-2 text-xs text-fg-tertiary">
                What <code className="text-fg-secondary">GET /namespaces/:id/plan</code> returns for a new account on this plan.
                Change anything above and your app picks it up on the next request.
              </p>
              <CodeBlock code={preview} lang="json" maxHeight={340} />
            </PanelSection>
          </>
        }
      />
      <PlanDialog appId={appId} open={duplicating} onOpenChange={setDuplicating} source={duplicating ? plan : null} />
    </>
  );
}

/** Sells this plan at its list price through the default offer. */
function CheckoutLink({ appId, planId }: { appId: string; planId: string }) {
  const { data: app } = useApp(appId);
  if (!app) return <Skeleton className="h-16" />;
  const url = planLink(app, planId, typeof window === "undefined" ? "" : window.location.origin);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 rounded-md border border-border bg-bg-subtle px-2 py-1.5">
        <code className="min-w-0 flex-1 truncate text-xs text-fg-secondary">{url}</code>
        <CopyButton value={url} label="Copy link" />
        <a href={url} target="_blank" rel="noreferrer" aria-label="Open checkout" className={buttonVariants({ variant: "ghost", size: "xs", icon: true })}>
          <ExternalLink />
        </a>
      </div>
      <p className="text-xs text-fg-tertiary">
        Regular price, no offer needed. For a sale price, extras or bumps,{" "}
        <Link href={`/apps/${appId}/offers/new`} className="text-accent-fg hover:underline">
          create an offer
        </Link>
        .{app.checkout_url ? null : " Points at the demo checkout until you set your own page in App settings."}
      </p>
    </div>
  );
}
