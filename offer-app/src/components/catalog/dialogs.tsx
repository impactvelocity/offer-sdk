"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Code, Copy, Gift, Hash, KeyRound, Layers, PencilLine, Puzzle, ToggleRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { InlineCode } from "@/components/developers/bits";
import { type ApiContext, addonUsage, entitlementUsage } from "@/components/developers/snippets";
import { Button } from "@/components/ui/button";
import { CodeTabs } from "@/components/ui/code-block";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tab, Tabs, TabsList, TabsPanel } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { useApiMutation, useWorkspace } from "@/lib/api/hooks";
import type { Addon, Entitlement, EntitlementType, Incentive, Plan } from "@/lib/api/types";
import { duplicateIncentive, duplicatePlan } from "@/lib/catalog-actions";
import { NameIdFields, useNameId } from "./name-id-fields";

/** Keeps the last non-null record so a closing dialog doesn't flash its "create" state. */
function useSticky<T>(value: T | null | undefined): T | null | undefined {
  const [last, setLast] = useState(value);
  if (value && value !== last) setLast(value);
  return value ?? last;
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
}

/** Dialog shell. The form inside only mounts while open, so its state starts fresh each time. */
function FormDialog({
  open,
  onOpenChange,
  size,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: "md" | "lg";
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={size}>{children}</DialogContent>
    </Dialog>
  );
}

function DialogForm({
  onClose,
  icon,
  title,
  submitLabel,
  pending,
  disabled,
  onSubmit,
  sdkUsage,
  children,
}: {
  onClose: () => void;
  icon: ReactNode;
  title: ReactNode;
  submitLabel: string;
  pending?: boolean;
  disabled?: boolean;
  onSubmit: () => void;
  /** Adds a "SDK usage" tab next to the form fields. */
  sdkUsage?: ReactNode;
  children: ReactNode;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled) onSubmit();
  };
  const form = (
    <>
      <DialogBody>{children}</DialogBody>
      <DialogFooter>
        <Button onClick={onClose} kbd="Esc">
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={pending} disabled={disabled} kbd="↵">
          {submitLabel}
        </Button>
      </DialogFooter>
    </>
  );
  return (
    <form onSubmit={submit}>
      <DialogHeader icon={icon} title={title} />
      {sdkUsage ? (
        <Tabs defaultValue="details">
          <TabsList className="px-3">
            <Tab value="details" icon={<PencilLine />}>
              Details
            </Tab>
            <Tab value="sdk" icon={<Code />}>
              SDK usage
            </Tab>
          </TabsList>
          <TabsPanel value="details">{form}</TabsPanel>
          <TabsPanel value="sdk">
            <DialogBody className="gap-4">{sdkUsage}</DialogBody>
          </TabsPanel>
        </Tabs>
      ) : (
        form
      )}
    </form>
  );
}

/** Env-var based snippets: real keys never appear in the dialogs. */
function useApiContext(appId: string): ApiContext {
  const { data: workspace } = useWorkspace();
  return { baseUrl: workspace?.apiBaseUrl ?? "", appId, secretKey: "", publicKey: "", real: false };
}

function SdkUsage({ appId, tabs }: { appId: string; tabs: Parameters<typeof CodeTabs>[0]["tabs"] }) {
  return (
    <>
      <p className="text-sm text-fg-tertiary">
        Uses the <InlineCode>useOfferPlan</InlineCode> hook from the{" "}
        <Link href={`/apps/${appId}/developers#check-access`} className="text-accent-fg hover:underline">
          integration guide
        </Link>
        . Client checks are for the UI; repeat the check on your server before doing anything that costs you.
      </p>
      <CodeTabs tabs={tabs} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Entitlements

const typeOptions: { value: EntitlementType; title: string; description: string; icon: ReactNode }[] = [
  { value: "usage", title: "Usage", description: "Counted against a limit, e.g. projects or credits.", icon: <Hash /> },
  { value: "boolean", title: "Feature flag", description: "On or off, e.g. SSO or PDF export.", icon: <ToggleRight /> },
];

export function TypePicker({
  value,
  onChange,
  disabled,
}: {
  value: EntitlementType;
  onChange: (value: EntitlementType) => void;
  disabled?: boolean;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as EntitlementType)}
      disabled={disabled}
      className="grid grid-cols-2 gap-2"
    >
      {typeOptions.map((t) => (
        <Radio.Root
          key={t.value}
          value={t.value}
          nativeButton
          render={<button type="button" />}
          className="flex flex-col items-start gap-1.5 rounded-lg border border-border bg-bg p-3 text-left outline-none transition-[border-color,box-shadow] hover:border-border-strong focus-visible:shadow-[0_0_0_3px_var(--ring)] data-checked:border-accent data-checked:shadow-[0_0_0_1px_var(--accent)] data-disabled:opacity-60"
        >
          <span className="flex size-6 items-center justify-center rounded-md bg-bg-muted text-fg-secondary [&_svg]:size-3.5">
            {t.icon}
          </span>
          <span className="text-sm font-medium text-fg">{t.title}</span>
          <span className="text-xs text-fg-tertiary">{t.description}</span>
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

export function EntitlementDialog({
  open,
  onOpenChange,
  appId,
  entitlement: entitlementProp,
  usedIn = 0,
}: DialogProps & { entitlement?: Entitlement | null; usedIn?: number }) {
  const entitlement = useSticky(entitlementProp);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} size={entitlement ? "lg" : "md"}>
      <EntitlementForm appId={appId} entitlement={entitlement} usedIn={usedIn} onClose={() => onOpenChange(false)} />
    </FormDialog>
  );
}

function EntitlementForm({
  appId,
  entitlement,
  usedIn,
  onClose,
}: {
  appId: string;
  entitlement?: Entitlement | null;
  usedIn: number;
  onClose: () => void;
}) {
  const editing = Boolean(entitlement);
  const fields = useNameId(entitlement ? { name: entitlement.name, id: entitlement.id } : undefined);
  const [type, setType] = useState<EntitlementType>(entitlement?.type ?? "usage");
  const [description, setDescription] = useState(entitlement?.description ?? "");
  const apiContext = useApiContext(appId);

  const save = useApiMutation(
    () =>
      editing
        ? api.entitlements.update(appId, entitlement!.id, { name: fields.name.trim(), type, description: description.trim() || null })
        : api.entitlements.create(appId, { id: fields.id, name: fields.name.trim(), type, description: description.trim() || null }),
    {
      success: (e) => (editing ? "Entitlement updated" : `${e.name} created`),
      onSuccess: onClose,
    },
  );

  return (
    <DialogForm
      onClose={onClose}
      icon={<KeyRound />}
      title={editing ? "Edit entitlement" : "Create entitlement"}
      submitLabel={editing ? "Save changes" : "Create entitlement"}
      pending={save.isPending}
      disabled={!fields.name.trim() || !fields.id}
      onSubmit={() => save.mutate()}
      sdkUsage={
        entitlement ? (
          <SdkUsage
            appId={appId}
            tabs={entitlementUsage(apiContext, { id: entitlement.id, name: fields.name.trim() || entitlement.name, type })}
          />
        ) : undefined
      }
    >
      <NameIdFields state={fields} namePlaceholder="e.g. AI credits" idEditable={!editing} />
      <Field
        label="Type"
        description={
          editing && type !== entitlement?.type && usedIn > 0
            ? `Changing the type affects ${usedIn} plan${usedIn === 1 ? "" : "s"} or incentive${usedIn === 1 ? "" : "s"} using it; existing limits stay as they are.`
            : undefined
        }
      >
        <TypePicker value={type} onChange={setType} />
      </Field>
      <Field label="Description" hint="(optional)">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this unlock or limit?"
          rows={2}
        />
      </Field>
    </DialogForm>
  );
}

// ---------------------------------------------------------------------------
// Add-ons

export function AddonDialog({ open, onOpenChange, appId, addon: addonProp }: DialogProps & { addon?: Addon | null }) {
  const addon = useSticky(addonProp);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} size={addon ? "lg" : "md"}>
      <AddonForm appId={appId} addon={addon} onClose={() => onOpenChange(false)} />
    </FormDialog>
  );
}

function AddonForm({ appId, addon, onClose }: { appId: string; addon?: Addon | null; onClose: () => void }) {
  const editing = Boolean(addon);
  const fields = useNameId(addon ? { name: addon.name, id: addon.id } : undefined);
  const [description, setDescription] = useState(addon?.description ?? "");
  const apiContext = useApiContext(appId);

  const save = useApiMutation(
    () =>
      editing
        ? api.addons.update(appId, addon!.id, { name: fields.name.trim(), description: description.trim() || null })
        : api.addons.create(appId, { id: fields.id, name: fields.name.trim(), description: description.trim() || null }),
    {
      success: (a) => (editing ? "Add-on updated" : `${a.name} created`),
      onSuccess: onClose,
    },
  );

  return (
    <DialogForm
      onClose={onClose}
      icon={<Puzzle />}
      title={editing ? "Edit add-on" : "Create add-on"}
      submitLabel={editing ? "Save changes" : "Create add-on"}
      pending={save.isPending}
      disabled={!fields.name.trim() || !fields.id}
      onSubmit={() => save.mutate()}
      sdkUsage={
        addon ? (
          <SdkUsage appId={appId} tabs={addonUsage(apiContext, { id: addon.id, name: fields.name.trim() || addon.name })} />
        ) : undefined
      }
    >
      <NameIdFields state={fields} namePlaceholder="e.g. Extra storage pack" idEditable={!editing} />
      <Field label="Description" hint="(optional)">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>
    </DialogForm>
  );
}

// ---------------------------------------------------------------------------
// Plans

export function PlanDialog({ open, onOpenChange, appId, source: sourceProp }: DialogProps & { source?: Plan | null }) {
  const source = useSticky(sourceProp);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      <PlanForm appId={appId} source={source} onClose={() => onOpenChange(false)} />
    </FormDialog>
  );
}

function PlanForm({ appId, source, onClose }: { appId: string; source?: Plan | null; onClose: () => void }) {
  const router = useRouter();
  const duplicating = Boolean(source);
  const fields = useNameId(source ? { name: `${source.name} copy`, id: `${source.id}_copy` } : undefined);
  const [description, setDescription] = useState(source?.description ?? "");
  const [isFree, setIsFree] = useState(source?.isFree ?? false);

  const save = useApiMutation(
    () =>
      source
        ? duplicatePlan(appId, { ...source, description: description.trim() || null, isFree }, { id: fields.id, name: fields.name.trim() })
        : api.plans.create(appId, { id: fields.id, name: fields.name.trim(), description: description.trim() || null, isFree }),
    {
      success: (p) => (duplicating ? `Duplicated as ${p.name}` : `${p.name} created`),
      onSuccess: (p) => {
        onClose();
        router.push(`/apps/${appId}/plans/${p.id}`);
      },
    },
  );

  return (
    <DialogForm
      onClose={onClose}
      icon={duplicating ? <Copy /> : <Layers />}
      title={duplicating ? `Duplicate ${source!.name}` : "Create plan"}
      submitLabel={duplicating ? "Duplicate plan" : "Create plan"}
      pending={save.isPending}
      disabled={!fields.name.trim() || !fields.id}
      onSubmit={() => save.mutate()}
    >
      {duplicating ? (
        <p className="-mt-1 text-sm text-fg-tertiary">
          Copies limits, add-ons, metadata and the pricing card. Accounts stay on {source!.name}.
        </p>
      ) : null}
      <NameIdFields state={fields} namePlaceholder="e.g. Pro" />
      <Field label="Description" hint="(optional)">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Who is this plan for?" />
      </Field>
      <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
        <span>
          <span className="block text-sm font-medium text-fg">Free plan</span>
          <span className="block text-xs text-fg-tertiary">No payment required. Exposed to the SDK as isFree.</span>
        </span>
        <Switch checked={isFree} onCheckedChange={setIsFree} />
      </label>
    </DialogForm>
  );
}

// ---------------------------------------------------------------------------
// Incentives

export function IncentiveDialog({
  open,
  onOpenChange,
  appId,
  source: sourceProp,
}: DialogProps & { source?: Incentive | null }) {
  const source = useSticky(sourceProp);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      <IncentiveForm appId={appId} source={source} onClose={() => onOpenChange(false)} />
    </FormDialog>
  );
}

function IncentiveForm({ appId, source, onClose }: { appId: string; source?: Incentive | null; onClose: () => void }) {
  const router = useRouter();
  const duplicating = Boolean(source);
  const fields = useNameId(source ? { name: `${source.name} copy`, id: `${source.id}_copy` } : undefined);
  const [description, setDescription] = useState(source?.description ?? "");

  const save = useApiMutation(
    () =>
      source
        ? duplicateIncentive(appId, { ...source, description: description.trim() || null }, { id: fields.id, name: fields.name.trim() })
        : api.incentives.create(appId, { id: fields.id, name: fields.name.trim(), description: description.trim() || null }),
    {
      success: (i) => (duplicating ? `Duplicated as ${i.name}` : `${i.name} created`),
      onSuccess: (i) => {
        onClose();
        router.push(`/apps/${appId}/incentives/${i.id}`);
      },
    },
  );

  return (
    <DialogForm
      onClose={onClose}
      icon={duplicating ? <Copy /> : <Gift />}
      title={duplicating ? `Duplicate ${source!.name}` : "Create incentive"}
      submitLabel={duplicating ? "Duplicate incentive" : "Create incentive"}
      pending={save.isPending}
      disabled={!fields.name.trim() || !fields.id}
      onSubmit={() => save.mutate()}
    >
      <p className="-mt-1 text-sm text-fg-tertiary">
        {duplicating
          ? `Copies every override and add-on from ${source!.name}.`
          : "Incentives layer on top of any plan: they raise or lift limits and grant extra add-ons for the accounts they're applied to."}
      </p>
      <NameIdFields state={fields} namePlaceholder="e.g. Black Friday 2026" />
      <Field label="Description" hint="(optional)">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>
    </DialogForm>
  );
}
