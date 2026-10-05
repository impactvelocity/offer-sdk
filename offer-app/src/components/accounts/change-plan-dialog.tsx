"use client";

import { ArrowRight, Gift, KeyRound, Layers, Puzzle } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { formatLimit, formatPrice } from "@/components/catalog/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { useAddons, useApiMutation, useEntitlements, useIncentives, usePlans, useResolvedAccess } from "@/lib/api/hooks";
import type { Account } from "@/lib/api/types";
import { formatNumber } from "@/lib/utils";
import { addonSources, NONE, resolveLimits, type ResolvedLimit } from "./resolve";

export type AccountRef = Pick<Account, "id" | "name" | "plan"> & { incentive?: string | null };

interface Props {
  appId: string;
  account: AccountRef | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focus?: "plan" | "incentive";
}

/**
 * Moves an account to another plan and/or sets its incentive. Choosing "None" removes the
 * incentive with its own call: the PATCH is a merge, so leaving it out can't clear it.
 */
export function ChangePlanDialog({ appId, account: accountProp, open, onOpenChange, focus = "plan" }: Props) {
  // Keep showing the last account and mode while the dialog animates closed.
  const account = useSticky(accountProp);
  const [shownFocus, setShownFocus] = useState(focus);
  if (open && focus !== shownFocus) setShownFocus(focus);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {account ? <ChangePlanForm appId={appId} account={account} focus={shownFocus} onOpenChange={onOpenChange} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/** Mounted per open, so the selects always start from the account's current plan and incentive. */
function ChangePlanForm({
  appId,
  account,
  focus,
  onOpenChange,
}: Omit<Props, "open" | "account" | "focus"> & { account: AccountRef; focus: "plan" | "incentive" }) {
  const { data: plans = [] } = usePlans(appId);
  const { data: incentives = [] } = useIncentives(appId);
  const { data: entitlements = [] } = useEntitlements(appId);
  const { data: addons = [] } = useAddons(appId);
  const addonName = useMemo(() => new Map(addons.map((a) => [a.id, a.name])), [addons]);
  const resolved = useResolvedAccess(appId, account.id);
  const currentIncentive = account.incentive ?? null;
  const [plan, setPlan] = useState<string | null>(account.plan);
  const [incentive, setIncentive] = useState(currentIncentive ?? NONE);

  const planExists = plans.some((p) => p.id === plan);
  const nextIncentive = incentive === NONE ? null : incentive;
  const changed = plan !== account.plan || nextIncentive !== currentIncentive;

  const save = useApiMutation(
    async () => {
      if (!plan) return;
      const patch: { plan?: string; incentive?: string } = {};
      if (plan !== account.plan) patch.plan = plan;
      if (nextIncentive && nextIncentive !== currentIncentive) patch.incentive = nextIncentive;
      if (patch.plan || patch.incentive) await api.accounts.update(appId, account.id, patch);
      if (!nextIncentive && currentIncentive) await api.accounts.removeIncentive(appId, account.id);
    },
    {
      success: () => {
        const planName = plans.find((p) => p.id === plan)?.name ?? plan;
        if (plan !== account.plan) return `Moved to ${planName}`;
        return nextIncentive ? "Incentive applied" : "Incentive removed";
      },
      onSuccess: () => onOpenChange(false),
    },
  );

  const changes = useMemo(() => {
    if (!changed) return [];
    const beforePlan = plans.find((p) => p.id === account.plan);
    const beforeIncentive = incentives.find((i) => i.id === currentIncentive);
    const afterPlan = plans.find((p) => p.id === plan);
    const afterIncentive = incentives.find((i) => i.id === nextIncentive);
    const before = resolveLimits(beforePlan, beforeIncentive);
    const after = resolveLimits(afterPlan, afterIncentive);
    const usage = new Map(resolved.data?.entitlements.map((e) => [e.id, e.usage]));
    const byId = new Map(entitlements.map((e) => [e.id, e]));
    const show = (limit: ResolvedLimit | undefined, type: string) =>
      !limit ? null : type === "boolean" ? "Included" : formatLimit(limit.max);

    const rows: ChangeRow[] = [...new Set([...before.keys(), ...after.keys()])]
      .filter((id) => !sameLimit(before.get(id), after.get(id)))
      .map((id) => {
        const type = byId.get(id)?.type ?? "usage";
        const max = after.get(id)?.max;
        const used = usage.get(id) ?? 0;
        return {
          key: id,
          icon: <KeyRound />,
          name: byId.get(id)?.name ?? id,
          from: show(before.get(id), type),
          to: show(after.get(id), type),
          overBy: type === "usage" && max !== undefined && max !== null && used > max ? used : null,
        };
      });

    const addonsBefore = addonSources(beforePlan, beforeIncentive);
    const addonsAfter = addonSources(afterPlan, afterIncentive);
    for (const id of new Set([...addonsBefore.keys(), ...addonsAfter.keys()])) {
      if (addonsBefore.has(id) === addonsAfter.has(id)) continue;
      rows.push({
        key: `addon:${id}`,
        icon: <Puzzle />,
        name: addonName.get(id) ?? id,
        from: addonsBefore.has(id) ? "Included" : null,
        to: addonsAfter.has(id) ? "Included" : null,
        overBy: null,
      });
    }
    return rows;
  }, [account, changed, plans, incentives, plan, nextIncentive, currentIncentive, resolved.data, entitlements, addonName]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (changed && planExists && !save.isPending) save.mutate();
  };

  const planSelect = (
    <Field label="Plan" key="plan">
      <Select
        value={planExists ? plan : null}
        onValueChange={setPlan}
        placeholder="Choose a plan"
        options={plans.map((p) => ({
          value: p.id,
          label: p.name,
          icon: <Layers />,
          description: formatPrice(p.pricingCard, p.isFree) ?? undefined,
        }))}
      />
    </Field>
  );
  const incentiveSelect = (
    <Field
      label="Incentive"
      key="incentive"
      description="Overlays the plan: raises limits and grants extra entitlements or add-ons."
    >
      <Select
        value={incentive}
        onValueChange={setIncentive}
        options={[
          { value: NONE, label: "None" },
          ...incentives.map((i) => ({ value: i.id, label: i.name, icon: <Gift /> })),
          // Keep a dangling incentive selectable so the dialog doesn't silently drop it.
          ...(currentIncentive && !incentives.some((i) => i.id === currentIncentive)
            ? [{ value: currentIncentive, label: `${currentIncentive} (deleted)`, icon: <Gift /> }]
            : []),
        ]}
      />
    </Field>
  );

  return (
    <form onSubmit={submit}>
      <DialogHeader
        icon={focus === "incentive" ? <Gift /> : <Layers />}
        title={focus === "plan" ? "Change plan" : currentIncentive ? "Change incentive" : "Apply incentive"}
        description={`For ${account.name || account.id}. Takes effect on your app's next access check.`}
      />
      <DialogBody>
        {focus === "incentive" ? [incentiveSelect, planSelect] : [planSelect, incentiveSelect]}
        {changes.length ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg-secondary">What changes</span>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {changes.map((c) => (
                <li key={c.key} className="flex h-9 items-center gap-2 px-3 text-sm">
                  <span className="flex text-fg-tertiary [&_svg]:size-3.5">{c.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-fg">{c.name}</span>
                  {c.overBy !== null ? <Badge color="red">{formatNumber(c.overBy)} used</Badge> : null}
                  <span className="flex shrink-0 items-center gap-1.5 tabular">
                    <span className="text-fg-tertiary">{c.from ?? "Not included"}</span>
                    <ArrowRight className="size-3 text-fg-placeholder" />
                    <span className={c.to ? "font-medium text-fg" : "text-fg-tertiary"}>{c.to ?? "Not included"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : changed && planExists ? (
          <p className="text-sm text-fg-tertiary">No limits, features or add-ons change.</p>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button onClick={() => onOpenChange(false)} kbd="Esc">
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={save.isPending} disabled={!changed || !planExists} kbd="↵">
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Keeps the last account so a closing dialog doesn't lose its content mid-animation. */
function useSticky<T>(value: T | null): T | null {
  const [last, setLast] = useState(value);
  if (value && value !== last) setLast(value);
  return value ?? last;
}

function sameLimit(a: ResolvedLimit | undefined, b: ResolvedLimit | undefined) {
  if (!a || !b) return a === b;
  return a.max === b.max;
}

interface ChangeRow {
  key: string;
  icon: ReactNode;
  name: string;
  /** Display value before/after; null = not included. */
  from: string | null;
  to: string | null;
  /** Current usage when it exceeds the new limit. */
  overBy: number | null;
}
