"use client";

import { ChevronsUpDown } from "lucide-react";
import { Menu, MenuCheckboxItem, MenuContent, MenuGroup, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import type { Entitlement } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** "All entitlements", "AI credits", "AI credits + Storage", "AI credits + 2 more". */
export function selectionLabel(ids: readonly string[], nameOf: (id: string) => string) {
  if (!ids.length) return "All entitlements";
  if (ids.length <= 2) return ids.map(nameOf).join(" + ");
  return `${nameOf(ids[0])} + ${ids.length - 1} more`;
}

/** Multi-select for the entitlements analytics focuses on. An empty selection means all. */
export function EntitlementPicker({
  entitlements,
  value,
  onValueChange,
  className,
}: {
  entitlements: Entitlement[];
  value: readonly string[];
  onValueChange: (ids: string[]) => void;
  className?: string;
}) {
  const names = new Map(entitlements.map((e) => [e.id, e.name]));
  const selected = new Set(value);
  const usage = entitlements.filter((e) => e.type === "usage");
  const flags = entitlements.filter((e) => e.type !== "usage");

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    // Keep catalog order so labels read the same however the set was built; unknown ids last.
    const order = entitlements.map((e) => e.id);
    onValueChange([...order.filter((x) => next.has(x)), ...value.filter((x) => next.has(x) && !names.has(x))]);
  };

  const group = (label: string, items: Entitlement[]) =>
    items.length ? (
      <MenuGroup>
        <MenuLabel>{label}</MenuLabel>
        {items.map((e) => (
          <MenuCheckboxItem key={e.id} checked={selected.has(e.id)} onCheckedChange={(on) => toggle(e.id, on)}>
            <span className="truncate">{e.name}</span>
          </MenuCheckboxItem>
        ))}
      </MenuGroup>
    ) : null;

  return (
    <Menu>
      <MenuTrigger
        aria-label="Entitlements"
        className={cn(
          "group flex h-8 min-w-0 items-center justify-between gap-2 rounded-md border border-border-input bg-bg px-2.5 text-left text-sm text-fg shadow-xs outline-none transition-[border-color,box-shadow] duration-100 hover:border-border-strong focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--ring)] data-popup-open:border-accent data-popup-open:shadow-[0_0_0_3px_var(--ring)]",
          className,
        )}
      >
        <span className="truncate">{selectionLabel(value, (id) => names.get(id) ?? id)}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-fg-icon" />
      </MenuTrigger>
      <MenuContent className="max-h-[min(24rem,var(--available-height))] min-w-56 overflow-y-auto scrollbar-thin">
        <MenuCheckboxItem checked={!value.length} onCheckedChange={(on) => on && onValueChange([])}>
          All entitlements
        </MenuCheckboxItem>
        <MenuSeparator />
        {group("Usage", usage)}
        {group("Feature flags", flags)}
      </MenuContent>
    </Menu>
  );
}
