"use client";

import { ArrowRight, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatPrice } from "@/components/catalog/format";
import { RecordIcon } from "@/components/catalog/record";
import { Badge, Chip, IdTag } from "@/components/ui/badge";
import { catalogLookup, formatEntitlementValue, type CatalogLookup } from "@/lib/agent/changes";
import type { Addon, Entitlement, EntitlementRef, Incentive, Plan } from "@/lib/api/types";
import { useAppId } from "@/lib/api/hooks";
import { cn, formatCurrency, pluralize } from "@/lib/utils";
import { KINDS } from "./change-card";

// What the agent's showCatalog tool renders: the records it looked up, as cards (plans,
// incentives) or a compact list (entitlements, add-ons). A snapshot from when it ran.

export interface CatalogOutput {
  kind: "plans" | "entitlements" | "addons" | "incentives";
  records: unknown[];
  accounts?: Record<string, number>;
  usedBy?: Record<string, string[]>;
  entitlements: Pick<Entitlement, "id" | "name" | "type">[];
  addons: Pick<Addon, "id" | "name">[];
}

const MAX_LINES = 6;

export function CatalogCards({ output }: { output: CatalogOutput }) {
  const empty = { plans: "No plans yet.", entitlements: "No entitlements yet.", addons: "No add-ons yet.", incentives: "No incentives yet." };
  if (!output.records.length) return <p className="text-sm text-fg-tertiary">{empty[output.kind]}</p>;
  // Laid out by the chat column's width (a container query), not the window's.
  return (
    <div className="@container w-full">
      <CatalogBody output={output} />
    </div>
  );
}

function CatalogBody({ output }: { output: CatalogOutput }) {
  const appId = useAppId();
  const lookup = catalogLookup(output.entitlements as Entitlement[], output.addons as Addon[]);
  switch (output.kind) {
    case "plans":
      return (
        <div className="grid gap-3 @lg:grid-cols-2">
          {(output.records as Plan[]).map((plan) => (
            <PlanCard key={plan.id} appId={appId} plan={plan} accounts={output.accounts?.[plan.id]} lookup={lookup} />
          ))}
        </div>
      );
    case "incentives":
      return (
        <div className="grid gap-3 @lg:grid-cols-2">
          {(output.records as Incentive[]).map((incentive) => (
            <RecordCard
              key={incentive.id}
              kind="incentive"
              href={KINDS.incentive.href(appId, incentive.id)}
              name={incentive.name}
              id={incentive.id}
              description={incentive.description}
            >
              <Limits refs={incentive.entitlements} addons={incentive.addons} lookup={lookup} empty="No overrides" />
            </RecordCard>
          ))}
        </div>
      );
    case "entitlements":
      return (
        <RecordList href={KINDS.entitlement.href(appId, "")}>
          {(output.records as Entitlement[]).map((e) => (
            <ListRow
              key={e.id}
              kind="entitlement"
              name={e.name}
              id={e.id}
              description={e.description}
              badge={e.type === "boolean" ? <Badge>Feature</Badge> : <Badge color="blue">Usage limit</Badge>}
              usedBy={output.usedBy?.[e.id]}
            />
          ))}
        </RecordList>
      );
    case "addons":
      return (
        <RecordList href={KINDS.addon.href(appId, "")}>
          {(output.records as Addon[]).map((a) => (
            <ListRow key={a.id} kind="addon" name={a.name} id={a.id} description={a.description} usedBy={output.usedBy?.[a.id]} />
          ))}
        </RecordList>
      );
  }
}

function PlanCard({ appId, plan, accounts, lookup }: { appId: string; plan: Plan; accounts?: number; lookup: CatalogLookup }) {
  const card = plan.pricingCard;
  const price = formatPrice(card, plan.isFree);
  const yearly = card?.type !== "one_time" && card?.monthlyPrice != null && card.yearlyPrice != null ? card.yearlyPrice : null;
  return (
    <RecordCard
      kind="plan"
      tone={plan.isFree ? "green" : "blue"}
      href={KINDS.plan.href(appId, plan.id)}
      name={plan.name}
      id={plan.id}
      badges={
        <>
          {plan.isFree ? <Badge color="green">Free</Badge> : null}
          {card?.featured ? <Badge color="brand">Featured</Badge> : null}
        </>
      }
      lead={
        <div className="flex items-baseline gap-2">
          <span className={cn("font-display text-xl font-semibold", price ? "text-fg" : "text-fg-tertiary text-base font-normal")}>
            {price ?? "No pricing"}
          </span>
          {yearly !== null ? <span className="text-sm text-fg-tertiary">or {formatCurrency(yearly, card!.currency)}/yr</span> : null}
        </div>
      }
      description={plan.description}
      footer={
        accounts !== undefined ? (
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5 text-fg-icon" />
            {pluralize(accounts, "account")}
          </span>
        ) : null
      }
    >
      <Limits refs={plan.entitlements} addons={plan.addons} lookup={lookup} empty="No entitlements" />
    </RecordCard>
  );
}

function Limits({ refs, addons, lookup, empty }: { refs: EntitlementRef[]; addons: string[]; lookup: CatalogLookup; empty: string }) {
  if (!refs.length && !addons.length) return <p className="text-sm text-fg-tertiary">{empty}</p>;
  const shown = refs.slice(0, MAX_LINES);
  return (
    <div className="flex flex-col gap-2.5">
      {refs.length ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {shown.map((ref) => (
            <li key={ref.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-fg-secondary">{lookup.entitlements.get(ref.id)?.name ?? ref.id}</span>
              <span className="shrink-0 font-medium tabular text-fg">{formatEntitlementValue(ref, lookup)}</span>
            </li>
          ))}
          {refs.length > MAX_LINES ? <li className="text-xs text-fg-tertiary">+{refs.length - MAX_LINES} more</li> : null}
        </ul>
      ) : null}
      {addons.length ? (
        <div className="flex flex-wrap gap-1.5">
          {addons.map((id) => (
            <Chip key={id} icon={KINDS.addon.icon}>
              {lookup.addons.get(id)?.name ?? id}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RecordCard({
  kind,
  tone,
  href,
  name,
  id,
  badges,
  lead,
  description,
  footer,
  children,
}: {
  kind: "plan" | "incentive";
  tone?: "green" | "blue" | "pink";
  href: string;
  name: string;
  id: string;
  badges?: ReactNode;
  lead?: ReactNode;
  description?: string | null;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-bg shadow-xs">
      <div className="flex flex-col gap-2 px-4 pt-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <RecordIcon size="sm" tone={tone ?? KINDS[kind].tone}>
            {KINDS[kind].icon}
          </RecordIcon>
          <span className="min-w-0 truncate text-sm font-semibold text-fg">{name}</span>
          {badges}
        </div>
        {lead}
        {description ? <p className="line-clamp-2 text-sm text-fg-tertiary">{description}</p> : null}
      </div>
      <div className="flex-1 px-4 py-3">{children}</div>
      <div className="flex items-center gap-3 border-t border-border bg-bg-subtle px-4 py-2 text-xs text-fg-tertiary">
        <IdTag className="h-5 text-xs">{id}</IdTag>
        <span className="flex-1">{footer}</span>
        <Link href={href} className="inline-flex items-center gap-1 font-medium text-accent-fg hover:underline underline-offset-2">
          Open
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

function RecordList({ href, children }: { href: string; children: ReactNode }) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-bg shadow-xs">
      <ul className="divide-y divide-border">{children}</ul>
      <div className="flex justify-end border-t border-border bg-bg-subtle px-4 py-2">
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-accent-fg hover:underline underline-offset-2">
          Open in dashboard
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

function ListRow({
  kind,
  name,
  id,
  description,
  badge,
  usedBy,
}: {
  kind: "entitlement" | "addon";
  name: string;
  id: string;
  description?: string | null;
  badge?: ReactNode;
  usedBy?: string[];
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <RecordIcon size="sm" tone={KINDS[kind].tone}>
        {KINDS[kind].icon}
      </RecordIcon>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium text-fg">{name}</span>
          <IdTag>{id}</IdTag>
          {badge}
        </div>
        {description ? <p className="mt-0.5 line-clamp-2 text-sm text-fg-tertiary">{description}</p> : null}
      </div>
      {usedBy ? (
        <span className="hidden max-w-[40%] shrink-0 truncate pt-0.5 text-right text-xs text-fg-tertiary @md:block" title={usedBy.join(", ")}>
          {usedBy.length ? usedBy.join(", ") : "Not on any plan"}
        </span>
      ) : null}
    </li>
  );
}
