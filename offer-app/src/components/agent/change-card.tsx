"use client";

import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { ArrowRight, Check, CircleAlert, Gift, KeyRound, Layers, Puzzle, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { RecordIcon } from "@/components/catalog/record";
import { Badge, IdTag } from "@/components/ui/badge";
import { Button, Spinner } from "@/components/ui/button";
import {
  catalogLookup,
  diffRecord,
  previewIncentiveUpdate,
  previewNewAddon,
  previewNewEntitlement,
  previewNewIncentive,
  previewNewPlan,
  previewPlanUpdate,
  previewSimpleUpdate,
  type CatalogLookup,
  type ChangeRow,
} from "@/lib/agent/changes";
import type { CatalogKind, CatalogRecord, ChangeResult, WriteToolName } from "@/lib/agent/types";
import { useAddons, useAppId, useEntitlements, useIncentiveAccounts, useIncentives, usePlanAccounts, usePlans } from "@/lib/api/hooks";
import type { Addon, Entitlement, Incentive, Plan } from "@/lib/api/types";
import { cn, pluralize } from "@/lib/utils";

// A write tool call as a record card: what will change (previewed against the live
// catalog), Approve / Decline while it waits, then what actually changed once applied.

type ToolState = (ToolUIPart | DynamicToolUIPart)["state"];

export interface ChangePart {
  name: WriteToolName;
  state: ToolState;
  // Tool inputs differ per tool; each branch below reads the fields its schema defines.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any;
  output?: ChangeResult;
  errorText?: string;
  approval?: { id: string; approved?: boolean };
}

type Action = "create" | "update" | "delete";

const TOOLS: Record<WriteToolName, { kind: CatalogKind; action: Action; idKey: string }> = {
  createPlan: { kind: "plan", action: "create", idKey: "id" },
  updatePlan: { kind: "plan", action: "update", idKey: "planId" },
  deletePlan: { kind: "plan", action: "delete", idKey: "planId" },
  createEntitlement: { kind: "entitlement", action: "create", idKey: "id" },
  updateEntitlement: { kind: "entitlement", action: "update", idKey: "entitlementId" },
  deleteEntitlement: { kind: "entitlement", action: "delete", idKey: "entitlementId" },
  createAddon: { kind: "addon", action: "create", idKey: "id" },
  updateAddon: { kind: "addon", action: "update", idKey: "addonId" },
  deleteAddon: { kind: "addon", action: "delete", idKey: "addonId" },
  createIncentive: { kind: "incentive", action: "create", idKey: "id" },
  updateIncentive: { kind: "incentive", action: "update", idKey: "incentiveId" },
  deleteIncentive: { kind: "incentive", action: "delete", idKey: "incentiveId" },
};

export const KINDS: Record<
  CatalogKind,
  { label: string; icon: ReactNode; tone: "blue" | "purple" | "orange" | "pink"; href: (appId: string, id: string) => string }
> = {
  plan: { label: "plan", icon: <Layers />, tone: "blue", href: (a, id) => `/apps/${a}/plans/${encodeURIComponent(id)}` },
  entitlement: { label: "entitlement", icon: <KeyRound />, tone: "purple", href: (a) => `/apps/${a}/entitlements` },
  addon: { label: "add-on", icon: <Puzzle />, tone: "orange", href: (a) => `/apps/${a}/addons` },
  incentive: { label: "incentive", icon: <Gift />, tone: "pink", href: (a, id) => `/apps/${a}/incentives/${encodeURIComponent(id)}` },
};

const VERBS: Record<Action, [present: string, past: string]> = {
  create: ["Create", "Created"],
  update: ["Update", "Updated"],
  delete: ["Delete", "Deleted"],
};

function useCatalog() {
  const appId = useAppId();
  const plans = usePlans(appId).data;
  const entitlements = useEntitlements(appId).data;
  const addons = useAddons(appId).data;
  const incentives = useIncentives(appId).data;
  return { appId, plans, entitlements, addons, incentives, lookup: catalogLookup(entitlements, addons) };
}

/** Before/after for a pending change, computed from the tool input and the current catalog. */
function preview(name: WriteToolName, input: ChangePart["input"], catalog: ReturnType<typeof useCatalog>) {
  const { kind, action, idKey } = TOOLS[name];
  const { appId, lookup } = catalog;
  const list: CatalogRecord[] | undefined = { plan: catalog.plans, entitlement: catalog.entitlements, addon: catalog.addons, incentive: catalog.incentives }[kind];
  const before = action === "create" ? null : (list?.find((r) => r.id === input?.[idKey]) ?? null);

  if (action === "create") {
    const after =
      kind === "plan"
        ? previewNewPlan(input, appId, lookup)
        : kind === "incentive"
          ? previewNewIncentive(input, appId, lookup)
          : kind === "entitlement"
            ? previewNewEntitlement(input, appId)
            : previewNewAddon(input, appId);
    return { before, after, loading: false };
  }
  if (!before) return { before, after: null, loading: list === undefined };
  if (action === "delete") return { before, after: null, loading: false };
  const after =
    kind === "plan"
      ? previewPlanUpdate(before as Plan, input, lookup)
      : kind === "incentive"
        ? previewIncentiveUpdate(before as Incentive, input, lookup)
        : previewSimpleUpdate(before as Entitlement | Addon, input);
  return { before, after, loading: false };
}

export function ChangeCard({
  part,
  canRespond,
  onRespond,
}: {
  part: ChangePart;
  /** Only the latest message's approvals can still be answered. */
  canRespond: boolean;
  onRespond: (approvalId: string, approved: boolean) => void;
}) {
  const catalog = useCatalog();
  const { kind, action, idKey } = TOOLS[part.name];
  const meta = KINDS[kind];
  const streaming = part.state === "input-streaming";
  const done = part.state === "output-available" && part.output;

  const computed = streaming ? null : done ? null : preview(part.name, part.input, catalog);
  const before = done ? part.output!.before : (computed?.before ?? null);
  const after = done ? part.output!.after : (computed?.after ?? null);
  const record = after ?? before;
  const recordId: string = record?.id ?? part.input?.[idKey] ?? "";
  const title = record?.name || part.input?.name || recordId;
  const rows = after ? diffRecord(kind, before, after, catalog.lookup) : [];

  const waiting = part.state === "approval-requested";
  const approved = part.approval?.approved;

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border bg-bg shadow-xs",
        waiting && canRespond ? "border-accent/40 shadow-[0_0_0_3px_var(--ring)]" : "border-border",
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <RecordIcon size="sm" tone={meta.tone}>
          {meta.icon}
        </RecordIcon>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-fg-tertiary">
            {VERBS[action][done ? 1 : 0]} {meta.label}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-fg">{title || "…"}</span>
            {recordId && recordId !== title ? <IdTag className="hidden sm:inline-flex">{recordId}</IdTag> : null}
          </div>
        </div>
        <StatusBadge state={part.state} approved={approved} canRespond={canRespond} />
      </div>

      <div className={cn("border-t border-border px-4 py-3", (part.state === "output-denied" || approved === false) && "opacity-60")}>
        {streaming ? (
          <Shimmer className="text-sm">Preparing the change…</Shimmer>
        ) : part.state === "output-error" ? (
          <p className="flex items-start gap-2 text-sm text-danger-fg">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {part.errorText || "The change failed."}
          </p>
        ) : action === "delete" ? (
          <DeleteSummary kind={kind} id={recordId} record={before} result={done ? part.output : undefined} catalog={catalog} />
        ) : computed?.loading ? (
          <Shimmer className="text-sm">{`Loading the current ${meta.label}…`}</Shimmer>
        ) : !after ? (
          <p className="text-sm text-fg-tertiary">
            No {meta.label} with id <code>{recordId}</code>.
          </p>
        ) : rows.length ? (
          <ChangeRows rows={rows} />
        ) : (
          <p className="text-sm text-fg-tertiary">Nothing changes.</p>
        )}
      </div>

      {waiting && canRespond && part.approval ? (
        <div className="flex items-center gap-2 border-t border-border bg-bg-subtle px-4 py-2.5">
          <span className="mr-auto flex items-center gap-1.5 text-xs text-fg-tertiary">
            <ShieldCheck className="size-3.5 text-fg-icon" />
            Nothing changes until you approve
          </span>
          <Button size="sm" onClick={() => onRespond(part.approval!.id, false)}>
            <X />
            Decline
          </Button>
          <Button size="sm" variant="primary" onClick={() => onRespond(part.approval!.id, true)}>
            <Check />
            Approve
          </Button>
        </div>
      ) : done && action !== "delete" && record ? (
        <div className="flex items-center justify-end border-t border-border bg-bg-subtle px-4 py-2">
          <Link
            href={meta.href(catalog.appId, record.id)}
            className="inline-flex items-center gap-1 text-sm font-medium text-accent-fg hover:underline underline-offset-2"
          >
            Open {meta.label}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ state, approved, canRespond }: { state: ToolState; approved?: boolean; canRespond: boolean }) {
  switch (state) {
    case "input-streaming":
    case "input-available":
      return <Spinner className="mt-1 size-4 text-fg-icon" />;
    case "approval-requested":
      return canRespond ? <Badge color="brand" dot>Needs approval</Badge> : <Badge>Not applied</Badge>;
    case "approval-responded":
      return approved ? (
        <Badge color="blue" icon={<Spinner className="size-3" />}>
          Applying
        </Badge>
      ) : (
        <Badge>Declined</Badge>
      );
    case "output-available":
      return (
        <Badge color="green" icon={<Check />}>
          Applied
        </Badge>
      );
    case "output-denied":
      return <Badge>Declined</Badge>;
    case "output-error":
      return <Badge color="red">Failed</Badge>;
  }
}

export function ChangeRows({ rows }: { rows: ChangeRow[] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {rows.map((row) => (
        <div key={row.key} className="contents">
          <dt className="flex min-w-0 items-start gap-1.5 text-fg-tertiary">
            <OpMark op={row.op} />
            <span className={cn("min-w-0 break-words", row.op === "remove" && "line-through decoration-fg-placeholder")}>
              {row.label}
            </span>
          </dt>
          <dd className="min-w-0 break-words text-fg">
            {row.op === "change" ? (
              <span className="inline-flex flex-wrap items-center gap-x-1.5">
                <span className="text-fg-tertiary line-through decoration-fg-placeholder">{row.from}</span>
                <ArrowRight className="size-3.5 shrink-0 text-fg-icon" />
                <span className="font-medium">{row.to}</span>
              </span>
            ) : row.op === "remove" ? (
              <span className="text-fg-tertiary">{row.from ? <s className="decoration-fg-placeholder">{row.from}</s> : "Removed"}</span>
            ) : (
              <span className="font-medium">{row.to ?? (row.op === "add" ? "Added" : "")}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function OpMark({ op }: { op: ChangeRow["op"] }) {
  if (op === "add") return <span className="w-3 shrink-0 font-semibold text-success-fg">+</span>;
  if (op === "remove") return <span className="w-3 shrink-0 font-semibold text-danger-fg">−</span>;
  return <span className="w-3 shrink-0" />;
}

function DeleteSummary({
  kind,
  id,
  record,
  result,
  catalog,
}: {
  kind: CatalogKind;
  id: string;
  record: CatalogRecord | null;
  result?: ChangeResult;
  catalog: { plans?: Plan[]; incentives?: Incentive[]; lookup: CatalogLookup };
}) {
  if (!record && !result) {
    return <p className="text-sm text-fg-tertiary">No {KINDS[kind].label} with id <code>{id}</code>.</p>;
  }
  const impact =
    result?.action === "deleted" ? (
      result.impact.length ? result.impact : ["Nothing else referenced it."]
    ) : kind === "plan" ? (
      <PlanImpact id={id} />
    ) : kind === "incentive" ? (
      <IncentiveImpact id={id} />
    ) : (
      referenceImpact(kind, id, catalog)
    );
  return (
    <div className="flex flex-col gap-2 text-sm">
      {record?.description ? <p className="text-fg-tertiary">{record.description}</p> : null}
      {Array.isArray(impact) ? (
        <ul className="flex flex-col gap-1">
          {impact.map((line) => (
            <li key={line} className="flex items-start gap-2 text-fg">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-fg-icon" />
              {line}
            </li>
          ))}
        </ul>
      ) : (
        impact
      )}
    </div>
  );
}

function referenceImpact(kind: CatalogKind, id: string, { plans = [], incentives = [] }: { plans?: Plan[]; incentives?: Incentive[] }) {
  const has = (o: Plan | Incentive) => (kind === "entitlement" ? o.entitlements.some((e) => e.id === id) : o.addons.includes(id));
  const lines: string[] = [];
  const p = plans.filter(has);
  const i = incentives.filter(has);
  if (p.length) lines.push(`Will be removed from plans: ${p.map((x) => x.name).join(", ")}`);
  if (i.length) lines.push(`Will be removed from incentives: ${i.map((x) => x.name).join(", ")}`);
  return lines.length ? lines : ["No plans or incentives include it."];
}

function PlanImpact({ id }: { id: string }) {
  const { data } = usePlanAccounts(useAppId(), id, 1, 1);
  if (!data) return <Shimmer className="text-sm">Checking accounts…</Shimmer>;
  return (
    <p className={data.total ? "text-warning-fg" : "text-fg"}>
      {data.total
        ? `${pluralize(data.total, "account")} ${data.total === 1 ? "is" : "are"} on this plan, so it can't be deleted until they move to another plan.`
        : "No accounts are on this plan."}
    </p>
  );
}

function IncentiveImpact({ id }: { id: string }) {
  const { data } = useIncentiveAccounts(useAppId(), id, 1, 1);
  if (!data) return <Shimmer className="text-sm">Checking accounts…</Shimmer>;
  return (
    <p className="text-fg">
      {data.total
        ? `Will be removed from ${pluralize(data.total, "account")}, which fall back to their plan's limits.`
        : "No accounts have this incentive."}
    </p>
  );
}
