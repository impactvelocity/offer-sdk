"use client";

import { Bookmark, BookmarkPlus, Check, ChevronDown, Pencil, Save, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuGroup, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { api } from "@/lib/api/client";
import { keys, useApiMutation } from "@/lib/api/hooks";
import type { SavedReport, SavedReportInput } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { selectionLabel } from "./entitlement-picker";
import { intervalLabel } from "./period-picker";

export const sameIds = (a: readonly string[], b: readonly string[]) => {
  const set = new Set(a);
  return set.size === new Set(b).size && b.every((id) => set.has(id));
};

export function reportSummary(view: Pick<SavedReportInput, "entitlements" | "interval">, nameOf: (id: string) => string) {
  return `${selectionLabel(view.entitlements, nameOf)} · ${intervalLabel(view.interval)}`;
}

/** Create / update / delete, refreshing only the report list (the analytics data is unaffected). */
export function useReportMutations(appId: string) {
  const invalidate = [keys.reports(appId)];
  return {
    create: useApiMutation((input: SavedReportInput) => api.analytics.reports.create(appId, input), {
      invalidate,
      success: (r) => `Saved “${r.name}”`,
    }),
    update: useApiMutation(
      ({ id, patch }: { id: string; patch: Partial<SavedReportInput> }) => api.analytics.reports.update(appId, id, patch),
      { invalidate, success: (r) => `Updated “${r.name}”` },
    ),
    remove: useApiMutation((id: string) => api.analytics.reports.delete(appId, id), { invalidate, success: "Report deleted" }),
  };
}

/** Toolbar dropdown: switch between saved reports and manage the active one. */
export function ReportsMenu({
  reports,
  active,
  dirty,
  nameOf,
  onApply,
  onSaveNew,
  onUpdate,
  onRename,
  onDelete,
}: {
  reports: SavedReport[];
  active: SavedReport | null;
  dirty: boolean;
  nameOf: (id: string) => string;
  onApply: (report: SavedReport) => void;
  onSaveNew: () => void;
  onUpdate: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <Menu>
      <MenuTrigger
        className={buttonVariants({
          variant: active ? "secondary" : "ghost",
          className: "max-w-60 data-popup-open:bg-bg-hover",
        })}
      >
        <Bookmark className={cn(active && "fill-current text-accent-fg")} />
        <span className="truncate">{active ? active.name : "Reports"}</span>
        {dirty ? <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-label="Edited" /> : null}
        <ChevronDown className="!size-3.5 text-fg-icon" />
      </MenuTrigger>
      <MenuContent className="w-80">
        <MenuGroup>
          <MenuLabel>Saved reports</MenuLabel>
          {reports.length ? (
            reports.map((r) => (
              <MenuItem key={r.id} onClick={() => onApply(r)} className="h-auto py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{r.name}</div>
                  <div className="truncate text-xs text-fg-tertiary">{reportSummary(r, nameOf)}</div>
                </div>
                {r.id === active?.id ? <Check className="!text-accent-fg" /> : null}
              </MenuItem>
            ))
          ) : (
            <p className="px-2.5 pb-2 pt-1 text-sm text-fg-tertiary">
              Save the entitlements and period you&apos;re looking at to come back to them in one click.
            </p>
          )}
        </MenuGroup>
        <MenuSeparator />
        <MenuItem onClick={onSaveNew}>
          <BookmarkPlus />
          Save as new report…
        </MenuItem>
        {active ? (
          <>
            <MenuItem onClick={onUpdate} disabled={!dirty}>
              <Save />
              Update “{active.name}”
            </MenuItem>
            <MenuItem onClick={onRename}>
              <Pencil />
              Rename…
            </MenuItem>
            <MenuItem tone="danger" onClick={onDelete}>
              <Trash2 />
              Delete report
            </MenuItem>
          </>
        ) : null}
      </MenuContent>
    </Menu>
  );
}

/** Name a new report, or rename an existing one. */
export function ReportNameDialog({
  open,
  onOpenChange,
  mode,
  initialName,
  summary,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "rename";
  initialName: string;
  summary: string;
  pending: boolean;
  onSubmit: (name: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {/* Keyed so the name resets each time the dialog opens. */}
        <NameForm
          key={`${mode}:${initialName}:${open}`}
          mode={mode}
          initialName={initialName}
          summary={summary}
          pending={pending}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function NameForm({
  mode,
  initialName,
  summary,
  pending,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "rename";
  initialName: string;
  summary: string;
  pending: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();
  const disabled = !trimmed || (mode === "rename" && trimmed === initialName);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled && !pending) onSubmit(trimmed);
  };

  return (
    <form onSubmit={submit}>
      <DialogHeader
        icon={mode === "create" ? <BookmarkPlus /> : <Pencil />}
        title={mode === "create" ? "Save report" : "Rename report"}
      />
      <DialogBody>
        <Field label="Name" description={mode === "create" ? `Saves ${summary}.` : summary}>
          <Input autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AI usage" />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onCancel} kbd="Esc">
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={pending} disabled={disabled} kbd="↵">
          {mode === "create" ? "Save report" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
