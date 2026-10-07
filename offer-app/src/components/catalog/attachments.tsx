"use client";

import { Hash, Infinity as InfinityIcon, KeyRound, Plus, ToggleRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { useConfirm } from "@/components/ui/confirm";
import { api } from "@/lib/api/client";
import { useApiMutation } from "@/lib/api/hooks";
import type { Addon, Entitlement, EntitlementRef } from "@/lib/api/types";
import { cn, formatNumber } from "@/lib/utils";

type OwnerKind = "plans" | "incentives";

interface Owner {
  kind: OwnerKind;
  id: string;
  name: string;
  entitlements: EntitlementRef[];
  addons: string[];
}

const client = (kind: OwnerKind) => (kind === "plans" ? api.plans : api.incentives);

function parseLimit(raw: string): number | null | "invalid" {
  const value = raw.trim().replace(/[,_\s]/g, "");
  if (!value || /^(unlimited|∞|inf)$/i.test(value)) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : "invalid";
}

/** Click-to-edit limit. Empty means unlimited. */
function LimitCell({ max, onSave, disabled }: { max: number | null; onSave: (max: number | null) => void; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  const start = () => {
    setDraft(max === null ? "" : String(max));
    setInvalid(false);
    setEditing(true);
  };

  const commit = () => {
    const parsed = parseLimit(draft);
    if (parsed === "invalid") return setInvalid(true);
    setEditing(false);
    if (parsed !== max) onSave(parsed);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={ref}
          size="sm"
          inputMode="numeric"
          value={draft}
          placeholder="Unlimited"
          aria-invalid={invalid}
          data-invalid={invalid || undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={commit}
          className="w-28 tabular"
        />
        <Tooltip content="Unlimited">
          <Button
            size="sm"
            icon
            variant="ghost"
            aria-label="Set unlimited"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setEditing(false);
              if (max !== null) onSave(null);
            }}
          >
            <InfinityIcon />
          </Button>
        </Tooltip>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled}
      className="-mx-2 flex h-8 min-w-24 items-center gap-1.5 rounded-md px-2 text-left text-sm tabular outline-none transition-colors hover:bg-bg-hover focus-visible:shadow-[0_0_0_2px_var(--ring)]"
    >
      {max === null ? (
        <span className="flex items-center gap-1 text-fg-secondary">
          <InfinityIcon className="size-3.5" />
          Unlimited
        </span>
      ) : (
        <span className="text-fg">{formatNumber(max)}</span>
      )}
    </button>
  );
}

export function EntitlementsEditor({ appId, owner, catalog }: { appId: string; owner: Owner; catalog: Entitlement[] }) {
  const confirm = useConfirm();
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const available = catalog.filter((e) => !owner.entitlements.some((r) => r.id === e.id));
  const [adding, setAdding] = useState<string | null>(null);
  const [limit, setLimit] = useState("");
  const selected = adding ? byId.get(adding) : undefined;
  const isIncentive = owner.kind === "incentives";

  const add = useApiMutation(
    ({ id, max }: { id: string; max?: number | null }) => client(owner.kind).addEntitlement(appId, owner.id, id, max),
    {
      success: (_, v) => `${byId.get(v.id)?.name ?? v.id} added`,
      onSuccess: () => {
        setAdding(null);
        setLimit("");
      },
    },
  );
  const update = useApiMutation(
    ({ id, max }: { id: string; max: number | null }) => client(owner.kind).updateEntitlement(appId, owner.id, id, max),
    { success: "Limit updated" },
  );
  const remove = useApiMutation((id: string) => client(owner.kind).removeEntitlement(appId, owner.id, id), {
    success: "Entitlement removed",
  });

  const submitAdd = () => {
    if (!selected) return;
    if (selected.type === "boolean") return add.mutate({ id: selected.id });
    const max = parseLimit(limit);
    if (max === "invalid") return;
    add.mutate({ id: selected.id, max });
  };

  return (
    <Card>
      <CardHeader
        title="Entitlements"
        description={
          isIncentive
            ? "Overrides the limit from the account's plan, or grants the entitlement if the plan doesn't include it."
            : "Features and limits accounts on this plan get. Click a limit to change it."
        }
      />
      {owner.entitlements.length === 0 ? (
        <EmptyState
          compact
          icon={<KeyRound />}
          title={isIncentive ? "No overrides yet" : "No entitlements yet"}
          description={
            catalog.length === 0 ? (
              <>
                Define entitlements first, then attach them here.{" "}
                <Link href={`/apps/${appId}/entitlements?new=1`} className="text-accent-fg hover:underline">
                  Create one
                </Link>
              </>
            ) : (
              "Add one below to start granting access."
            )
          }
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Entitlement</TH>
              <TH className="w-32">Type</TH>
              <TH className="w-48">{isIncentive ? "Override" : "Limit"}</TH>
              <TH className="w-12" />
            </tr>
          </THead>
          <TBody>
            {owner.entitlements.map((ref) => {
              const ent = byId.get(ref.id);
              const type = ent?.type ?? "usage";
              return (
                <TR key={ref.id}>
                  <TD>
                    <div className="flex items-center gap-2">
                      <span className={cn("truncate", !ent && "text-fg-tertiary line-through")}>{ent?.name ?? ref.id}</span>
                      <code className="truncate text-xs text-fg-tertiary">{ref.id}</code>
                      {!ent ? <Badge color="red">Deleted</Badge> : null}
                    </div>
                  </TD>
                  <TD>{type === "usage" ? <Badge color="blue">Usage</Badge> : <Badge color="brand">Feature</Badge>}</TD>
                  <TD className="py-1">
                    {type === "usage" ? (
                      <LimitCell
                        max={ref.max ?? null}
                        disabled={update.isPending}
                        onSave={(max) => update.mutate({ id: ref.id, max })}
                      />
                    ) : (
                      <span className="text-fg-secondary">Included</span>
                    )}
                  </TD>
                  <TD align="center" className="px-1">
                    <Tooltip content="Remove">
                      <Button
                        icon
                        size="xs"
                        variant="ghost"
                        aria-label={`Remove ${ent?.name ?? ref.id}`}
                        className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
                        onClick={async () => {
                          if (
                            await confirm({
                              title: `Remove ${ent?.name ?? ref.id}?`,
                              description: isIncentive
                                ? `Accounts with ${owner.name} will fall back to their plan's limit.`
                                : `Accounts on ${owner.name} lose this entitlement immediately (unless an incentive grants it).`,
                              confirmLabel: "Remove",
                            })
                          )
                            remove.mutate(ref.id);
                        }}
                      >
                        <X />
                      </Button>
                    </Tooltip>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
      {available.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-bg-subtle px-5 py-3 first:border-t-0">
          <Select
            size="sm"
            value={adding}
            onValueChange={setAdding}
            placeholder="Add entitlement…"
            className="w-60 bg-bg"
            aria-label="Entitlement to add"
            options={available.map((e) => ({
              value: e.id,
              label: e.name,
              icon: e.type === "usage" ? <Hash /> : <ToggleRight />,
            }))}
          />
          {selected?.type === "usage" ? (
            <Input
              size="sm"
              inputMode="numeric"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAdd()}
              placeholder="Limit (empty = unlimited)"
              className="w-48 tabular"
              data-invalid={parseLimit(limit) === "invalid" || undefined}
            />
          ) : null}
          <Button size="sm" onClick={submitAdd} disabled={!selected || parseLimit(limit) === "invalid"} loading={add.isPending}>
            <Plus />
            Add
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export function AddonsEditor({ appId, owner, catalog }: { appId: string; owner: Owner; catalog: Addon[] }) {
  const confirm = useConfirm();
  const byId = new Map(catalog.map((a) => [a.id, a]));
  const available = catalog.filter((a) => !owner.addons.includes(a.id));
  const [adding, setAdding] = useState<string | null>(null);

  const add = useApiMutation((id: string) => client(owner.kind).addAddon(appId, owner.id, id), {
    success: (_, id) => `${byId.get(id)?.name ?? id} added`,
    onSuccess: () => setAdding(null),
  });
  const remove = useApiMutation((id: string) => client(owner.kind).removeAddon(appId, owner.id, id), {
    success: "Add-on removed",
  });

  return (
    <Card>
      <CardHeader
        title="Add-ons"
        description={
          owner.kind === "incentives"
            ? "Granted on top of whatever the account's plan includes."
            : "Extras included with this plan, returned to the SDK as addons."
        }
      />
      {owner.addons.length === 0 ? (
        <div className="px-5 py-5 text-sm text-fg-tertiary">
          {catalog.length === 0 ? (
            <>
              No add-ons defined.{" "}
              <Link href={`/apps/${appId}/addons?new=1`} className="text-accent-fg hover:underline">
                Create one
              </Link>
            </>
          ) : (
            "No add-ons included."
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {owner.addons.map((id) => {
            const addon = byId.get(id);
            return (
              <li key={id} className="group/row flex h-12 items-center gap-2.5 px-5">
                <span className={cn("truncate text-sm", !addon && "text-fg-tertiary line-through")}>{addon?.name ?? id}</span>
                <code className="truncate text-xs text-fg-tertiary">{id}</code>
                {!addon ? <Badge color="red">Deleted</Badge> : null}
                <Button
                  icon
                  size="xs"
                  variant="ghost"
                  aria-label={`Remove ${addon?.name ?? id}`}
                  className="ml-auto opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: `Remove ${addon?.name ?? id}?`,
                        description:
                          owner.kind === "incentives"
                            ? `Accounts with ${owner.name} keep this add-on only if their plan includes it.`
                            : `Accounts on ${owner.name} lose this add-on immediately (unless an incentive grants it).`,
                        confirmLabel: "Remove",
                      })
                    )
                      remove.mutate(id);
                  }}
                >
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {available.length > 0 ? (
        <div className="flex items-center gap-2 border-t border-border bg-bg-subtle px-5 py-3">
          <Select
            size="sm"
            value={adding}
            onValueChange={setAdding}
            placeholder="Add add-on…"
            className="w-60 bg-bg"
            aria-label="Add-on to add"
            options={available.map((a) => ({ value: a.id, label: a.name }))}
          />
          <Button size="sm" onClick={() => adding && add.mutate(adding)} disabled={!adding} loading={add.isPending}>
            <Plus />
            Add
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
