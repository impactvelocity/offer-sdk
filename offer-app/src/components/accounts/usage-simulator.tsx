"use client";

import { useState, type FormEvent } from "react";
import { formatLimit } from "@/components/catalog/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { UsageBar } from "@/components/ui/usage-bar";
import { api } from "@/lib/api/client";
import { keys, useApiMutation } from "@/lib/api/hooks";
import type { ResolvedEntitlement, UsageOperation } from "@/lib/api/types";
import { formatNumber } from "@/lib/utils";

/** Sends real tracking calls (add / remove / amount) for one account, as the tenant's app would. */
export function UsageSimulator({
  appId,
  accountId,
  entitlements,
  unavailable,
}: {
  appId: string;
  accountId: string;
  /** Resolved usage entitlements for the account. */
  entitlements: ResolvedEntitlement[];
  unavailable?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [last, setLast] = useState<{ entitlement: string; op: UsageOperation; count: number } | null>(null);
  const current = entitlements.find((e) => e.id === selected) ?? entitlements[0];

  const track = useApiMutation(
    ({ op, value }: { op: UsageOperation; value?: number }) => {
      const id = current!.id;
      if (op === "add") return api.accounts.usage.add(appId, accountId, id);
      if (op === "remove") return api.accounts.usage.remove(appId, accountId, id);
      return api.accounts.usage.amount(appId, accountId, id, value!);
    },
    {
      invalidate: [keys.account(appId, accountId), keys.analytics(appId)],
      onSuccess: (res, { op }) => setLast({ entitlement: res.entitlement, op, count: res.count }),
    },
  );

  const parsed = Number(amount);
  const amountValid = amount.trim() !== "" && Number.isInteger(parsed) && parsed !== 0;
  const submitAmount = (e: FormEvent) => {
    e.preventDefault();
    if (!amountValid || track.isPending) return;
    track.mutate({ op: "amount", value: parsed }, { onSuccess: () => setAmount("") });
  };

  if (unavailable || !current) {
    return <p className="text-sm text-fg-tertiary">{unavailable ?? "This account has no usage entitlements to track."}</p>;
  }

  const pending = track.isPending ? track.variables?.op : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-fg-tertiary">Send the same calls your app makes.</p>
      <Select
        size="sm"
        aria-label="Entitlement"
        value={current.id}
        onValueChange={setSelected}
        options={entitlements.map((e) => ({ value: e.id, label: e.name }))}
      />
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg-subtle px-4 py-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-xs text-fg-tertiary">Current count</div>
            <div className="tabular">
              <span className="font-display text-xl font-semibold text-fg">{formatNumber(current.usage)}</span>
              <span className="ml-1 text-sm text-fg-tertiary">/ {formatLimit(current.max)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              className="tabular"
              aria-label="Remove 1"
              loading={pending === "remove"}
              disabled={Boolean(pending)}
              onClick={() => track.mutate({ op: "remove" })}
            >
              −1
            </Button>
            <Button
              size="sm"
              className="tabular"
              aria-label="Add 1"
              loading={pending === "add"}
              disabled={Boolean(pending)}
              onClick={() => track.mutate({ op: "add" })}
            >
              +1
            </Button>
          </div>
        </div>
        <UsageBar usage={current.usage} max={current.max} />
      </div>
      <form onSubmit={submitAmount} className="flex items-center gap-2">
        <Input
          size="sm"
          type="number"
          step={1}
          inputMode="numeric"
          aria-label="Amount"
          placeholder="Amount, e.g. 25 or -10"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button size="sm" type="submit" loading={pending === "amount"} disabled={!amountValid || Boolean(pending)}>
          Add amount
        </Button>
      </form>
      {amount.trim() && !amountValid ? (
        <p className="-mt-1 text-xs text-danger-fg">Use a whole number other than 0.</p>
      ) : null}
      {last && last.entitlement === current.id ? (
        <p className="text-xs text-fg-tertiary">
          <code className="text-fg-secondary">
            POST …/usage/{last.entitlement}/{last.op}
          </code>{" "}
          → count <span className="tabular font-medium text-fg">{formatNumber(last.count)}</span>
        </p>
      ) : null}
      <p className="text-xs text-fg-tertiary">
        The API doesn&apos;t enforce limits on writes — your app should check <code className="text-fg-secondary">can</code>{" "}
        first.
      </p>
    </div>
  );
}
