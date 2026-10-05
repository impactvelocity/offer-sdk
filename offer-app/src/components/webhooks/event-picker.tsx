"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ALL_EVENTS, WEBHOOK_CATEGORIES, WEBHOOK_EVENTS } from "@/lib/webhooks/catalog";

/** "All events" switch, then checkboxes grouped by resource. `value` is the API's events list. */
export function EventPicker({ value, onChange }: { value: string[]; onChange: (events: string[]) => void }) {
  const all = value.includes(ALL_EVENTS);
  const selected = new Set(value);

  const toggle = (types: string[], on: boolean) => {
    const next = new Set(selected);
    for (const t of types) {
      if (on) next.add(t);
      else next.delete(t);
    }
    onChange(WEBHOOK_EVENTS.map((e) => e.type).filter((t) => next.has(t)));
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <label className="flex cursor-pointer items-center justify-between gap-3 bg-bg-subtle px-4 py-3">
        <span>
          <span className="block text-sm font-medium text-fg">All events</span>
          <span className="block text-xs text-fg-tertiary">Includes event types added in the future.</span>
        </span>
        <Switch checked={all} onCheckedChange={(on) => onChange(on ? [ALL_EVENTS] : [])} />
      </label>
      <div className={cn("grid gap-px border-t border-border bg-border sm:grid-cols-2", all && "pointer-events-none")} aria-disabled={all}>
        {WEBHOOK_CATEGORIES.map((category) => {
          const types = WEBHOOK_EVENTS.filter((e) => e.category === category.id);
          const count = types.filter((t) => all || selected.has(t.type)).length;
          return (
            <fieldset key={category.id} className={cn("flex flex-col gap-1 bg-bg px-4 py-3", all && "[&>*]:opacity-50")}>
              <label className="mb-1 flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  checked={count === types.length}
                  indeterminate={count > 0 && count < types.length}
                  disabled={all}
                  onCheckedChange={(on) => toggle(types.map((t) => t.type), on)}
                />
                <span className="text-sm font-semibold text-fg">{category.title}</span>
              </label>
              {types.map((t) => (
                <label key={t.type} className="flex cursor-pointer items-center gap-2.5 py-0.5 pl-6">
                  <Checkbox
                    checked={all || selected.has(t.type)}
                    disabled={all}
                    onCheckedChange={(on) => toggle([t.type], on)}
                  />
                  <code className="truncate text-[13px] text-fg-secondary">{t.type}</code>
                </label>
              ))}
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
