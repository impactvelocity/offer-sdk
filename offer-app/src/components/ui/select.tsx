"use client";

import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { popupItem, popupSurface } from "./popup";

export interface SelectOption<V extends string = string> {
  value: V;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

interface SelectProps<V extends string> {
  value: V | null;
  onValueChange: (value: V) => void;
  options: SelectOption<V>[];
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
}

export function Select<V extends string = string>({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  className,
  size = "md",
  disabled,
  id,
  name,
  "aria-label": ariaLabel,
}: SelectProps<V>) {
  const items = options.map((o) => ({ value: o.value, label: o.label }));
  return (
    <BaseSelect.Root
      items={items}
      value={value}
      onValueChange={(v) => v !== null && onValueChange(v as V)}
      disabled={disabled}
      name={name}
    >
      <BaseSelect.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "group flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-border-input bg-bg text-left text-sm text-fg shadow-xs outline-none transition-[border-color,box-shadow] duration-100 hover:border-border-strong focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--ring)] data-disabled:cursor-not-allowed data-disabled:bg-bg-muted data-disabled:text-fg-tertiary data-popup-open:border-accent data-popup-open:shadow-[0_0_0_3px_var(--ring)]",
          size === "sm" ? "h-8 px-2.5" : "h-9 px-3",
          className,
        )}
      >
        <BaseSelect.Value className="truncate data-placeholder:text-fg-placeholder" placeholder={placeholder} />
        <BaseSelect.Icon className="flex text-fg-icon">
          <ChevronsUpDown className="size-3.5" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner className="z-50 outline-none" sideOffset={4} alignItemWithTrigger={false}>
          <BaseSelect.Popup className={cn(popupSurface, "min-w-[max(var(--anchor-width),12rem)] max-w-[min(28rem,var(--available-width))]")}>
            <BaseSelect.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto scrollbar-thin">
              {options.map((o) => (
                <BaseSelect.Item
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  className={cn(popupItem, "pr-8 relative", o.description && "h-auto py-1.5")}
                >
                  {o.icon}
                  <div className="min-w-0">
                    <BaseSelect.ItemText className="block truncate">{o.label}</BaseSelect.ItemText>
                    {o.description ? <div className="truncate text-xs text-fg-tertiary">{o.description}</div> : null}
                  </div>
                  <BaseSelect.ItemIndicator className="absolute right-2 flex">
                    <Check className="!text-accent" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
