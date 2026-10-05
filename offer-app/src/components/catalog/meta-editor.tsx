"use client";

import { Braces, Lock, LockOpen, Plus, X } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { InlineCode } from "@/components/developers/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { api } from "@/lib/api/client";
import { useApiMutation } from "@/lib/api/hooks";
import type { MetaValue, Plan } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface Row {
  uid: string;
  key: string;
  value: string;
  private: boolean;
}

const sanitizeKey = (k: string) => k.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "");

const show = (v: MetaValue) => (typeof v === "string" ? v : JSON.stringify(v));

/** Strings stay strings; null/booleans/numbers/JSON are parsed so the SDK gets real types. */
function parse(raw: string): MetaValue {
  const t = raw.trim();
  if (t === "null") return null;
  if (t === "true" || t === "false") return t === "true";
  if (t !== "" && !Number.isNaN(Number(t)) && /^-?\d/.test(t)) return Number(t);
  if (/^[[{]/.test(t)) {
    try {
      return JSON.parse(t);
    } catch {
      /* keep as string */
    }
  }
  return raw;
}

function kind(v: MetaValue) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v === "object" ? "object" : typeof v;
}

const toRows = (plan: Plan): Row[] =>
  Object.entries(plan.meta ?? {}).map(([key, value], i) => ({
    uid: `${key}-${i}`,
    key,
    value: show(value),
    private: plan.privateMetaKeys?.includes(key) ?? false,
  }));

export function MetaEditor({ appId, plan }: { appId: string; plan: Plan }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(plan));
  // Re-sync the draft whenever the saved metadata changes (after a save or an edit elsewhere).
  const savedKey = JSON.stringify([plan.meta, plan.privateMetaKeys]);
  const [syncedKey, setSyncedKey] = useState(savedKey);
  if (savedKey !== syncedKey) {
    setSyncedKey(savedKey);
    setRows(toRows(plan));
  }

  const next = useMemo(() => {
    const meta: Record<string, MetaValue> = {};
    for (const r of rows) if (r.key) meta[r.key] = parse(r.value);
    const privateMetaKeys = rows.filter((r) => r.key && r.private).map((r) => r.key);
    return { meta, privateMetaKeys };
  }, [rows]);

  const duplicates = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const r of rows) {
      if (!r.key) continue;
      if (seen.has(r.key)) dupes.add(r.key);
      seen.add(r.key);
    }
    return dupes;
  }, [rows]);

  const dirty =
    JSON.stringify(next.meta) !== JSON.stringify(plan.meta ?? {}) ||
    JSON.stringify([...next.privateMetaKeys].sort()) !== JSON.stringify([...(plan.privateMetaKeys ?? [])].sort());

  // PATCH replaces top-level fields, so sending the whole `meta` object also removes deleted keys.
  const save = useApiMutation(() => api.plans.update(appId, plan.id, next), { success: "Metadata saved" });

  const update = (uid: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));

  return (
    <div className="@container flex flex-col gap-4">
      <Card>
        <CardHeader title="Metadata" />
        {rows.length === 0 ? (
          <EmptyState compact icon={<Braces />} title="No metadata" description="Add key/value pairs your app can read at runtime." />
        ) : (
          <div className="flex flex-col">
            <div className="grid grid-cols-[minmax(0,200px)_minmax(0,1fr)_84px_36px] gap-2 border-b border-border px-5 py-2.5 text-xs font-medium text-fg-tertiary">
              <span>Key</span>
              <span>Value</span>
              <span>Visibility</span>
              <span />
            </div>
            {rows.map((r) => {
              const parsed = parse(r.value);
              return (
                <div
                  key={r.uid}
                  className="grid grid-cols-[minmax(0,200px)_minmax(0,1fr)_84px_36px] items-center gap-2 border-b border-border px-5 py-2 last:border-b-0"
                >
                  <Input
                    size="sm"
                    value={r.key}
                    placeholder="key"
                    onChange={(e) => update(r.uid, { key: sanitizeKey(e.target.value) })}
                    className="font-mono text-[13px]"
                    data-invalid={duplicates.has(r.key) || undefined}
                  />
                  <div className="relative">
                    <Input
                      size="sm"
                      value={r.value}
                      placeholder="value"
                      onChange={(e) => update(r.uid, { value: e.target.value })}
                      className="pr-16 font-mono text-[13px]"
                    />
                    <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2">
                      <Badge color={kind(parsed) === "string" ? "gray" : "blue"} className="h-4 px-1 text-[11px]">
                        {kind(parsed)}
                      </Badge>
                    </span>
                  </div>
                  <Tooltip content={r.private ? "Private: secret key only" : "Public: returned to the SDK"}>
                    <button
                      type="button"
                      onClick={() => update(r.uid, { private: !r.private })}
                      className={cn(
                        "flex h-7 items-center gap-1 rounded-md px-1.5 text-xs font-medium outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--ring)] [&_svg]:size-3.5",
                        r.private ? "bg-warning-subtle text-warning-fg" : "text-fg-tertiary hover:bg-bg-hover",
                      )}
                    >
                      {r.private ? <Lock /> : <LockOpen />}
                      {r.private ? "Private" : "Public"}
                    </button>
                  </Tooltip>
                  <Button
                    icon
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${r.key || "field"}`}
                    onClick={() => setRows((rs) => rs.filter((x) => x.uid !== r.uid))}
                  >
                    <X />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-border bg-bg-subtle px-5 py-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRows((rs) => [...rs, { uid: `new-${Date.now()}`, key: "", value: "", private: false }])}
          >
            <Plus />
            Add field
          </Button>
          {duplicates.size ? <span className="text-xs text-danger-fg">Duplicate key: {[...duplicates].join(", ")}</span> : null}
          <div className="ml-auto flex items-center gap-2">
            {dirty ? (
              <Button size="sm" onClick={() => setRows(toRows(plan))} disabled={save.isPending}>
                Discard
              </Button>
            ) : null}
            <Button size="sm" variant="primary" disabled={!dirty || duplicates.size > 0} loading={save.isPending} onClick={() => save.mutate()}>
              Save metadata
            </Button>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-3">
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-fg [&_svg]:size-4 [&_svg]:text-fg-icon">
            <Braces />
            What to store
          </div>
          <dl className="flex flex-col gap-1.5 text-sm">
            {USES.map(([label, key]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <dt className="text-fg-tertiary">{label}</dt>
                <dd>
                  <InlineCode className="text-xs">{key}</InlineCode>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-auto text-xs text-fg-tertiary">Numbers, booleans and JSON are parsed, so the SDK gets real types.</p>
        </div>
        <VisibilityNote
          icon={<LockOpen />}
          label="Public"
          route="GET …/plan"
          body="Returned to the SDK, so your frontend can read it. Use for anything you'd show a customer."
        />
        <VisibilityNote
          icon={<Lock />}
          label="Private"
          route="GET …/full-plan"
          tone="warning"
          body="Stays on the plan but is stripped from the SDK response. Your backend reads it with the secret key, e.g. a payment provider price id."
        />
      </div>
    </div>
  );
}

const USES: [label: string, key: string][] = [
  ["Feature config", "max_projects"],
  ["Pricing-page copy", "badge"],
  ["External ids", "stripe_price_id"],
];

function VisibilityNote({
  icon,
  label,
  route,
  body,
  tone,
}: {
  icon: ReactNode;
  label: string;
  route: string;
  body: string;
  tone?: "warning";
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <span
        className={cn(
          "flex h-6 items-center gap-1 self-start rounded-md px-1.5 text-xs font-medium [&_svg]:size-3.5",
          tone === "warning" ? "bg-warning-subtle text-warning-fg" : "bg-bg-muted text-fg-secondary",
        )}
      >
        {icon}
        {label}
      </span>
      <p className="text-sm text-fg-tertiary">{body}</p>
      <InlineCode className="mt-auto self-start text-xs">{route}</InlineCode>
    </div>
  );
}
