"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Gift, Layers, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatPrice } from "@/components/catalog/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { ApiError, api } from "@/lib/api/client";
import { keys, useIncentives, usePlans } from "@/lib/api/hooks";
import { Callout } from "@/components/ui/callout";
import { NONE } from "./resolve";

interface Props {
  appId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAccountDialog({ appId, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted per open, so every open starts from a clean form. */}
        <CreateAccountForm appId={appId} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

function CreateAccountForm({ appId, onOpenChange }: Omit<Props, "open">) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: plans = [], isLoading: plansLoading } = usePlans(appId);
  const { data: incentives = [] } = useIncentives(appId);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<string | null>(null);
  const [incentive, setIncentive] = useState(NONE);
  const [error, setError] = useState<{ field: "id" | "form"; message: string } | null>(null);

  // Default to the free plan (what most sign-ups start on), else the first one.
  const planId = plan ?? plans.find((p) => p.isFree)?.id ?? plans[0]?.id ?? null;
  const trimmedId = id.trim();

  const create = useMutation({
    mutationFn: () =>
      api.accounts.create(appId, {
        id: trimmedId,
        name: name.trim() || trimmedId,
        plan: planId!,
        incentive: incentive === NONE ? null : incentive,
      }),
    onSuccess: (account) => {
      void queryClient.invalidateQueries({ queryKey: keys.app(appId) });
      toast.success(`${account.name || account.id} created`);
      onOpenChange(false);
      router.push(`/apps/${appId}/accounts/${encodeURIComponent(account.id)}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        setError({ field: "id", message: `An account with the ID “${trimmedId}” already exists.` });
      } else {
        setError({ field: "form", message: e instanceof Error ? e.message : "Something went wrong" });
      }
    },
  });

  const disabled = !trimmedId || !planId;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled && !create.isPending) create.mutate();
  };

  return (
    <form onSubmit={submit}>
      <DialogHeader icon={<UserPlus />} title="Create account" />
      <DialogBody>
        {!plansLoading && !plans.length ? (
          <Callout
            tone="warning"
            action={
              <Link href={`/apps/${appId}/plans?new=1`} className="font-medium underline-offset-2 hover:underline">
                Create a plan
              </Link>
            }
          >
            Create a plan first — every account needs one.
          </Callout>
        ) : null}
        <Field
          label="Account ID"
          description="The user or team id from your product, e.g. usr_123 or team_acme."
          error={error?.field === "id" ? error.message : undefined}
        >
          <Input
            autoFocus
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              if (error?.field === "id") setError(null);
            }}
            placeholder="usr_123"
            className="font-mono text-[13.5px]"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <Field label="Name" hint="(optional)" description="Shown in the dashboard. Defaults to the ID.">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Inc. or jane@acme.com" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plan">
            <Select
              value={planId}
              onValueChange={setPlan}
              placeholder={plansLoading ? "Loading…" : "No plans"}
              disabled={!plans.length}
              options={plans.map((p) => ({
                value: p.id,
                label: p.name,
                icon: <Layers />,
                description: formatPrice(p.pricingCard, p.isFree) ?? undefined,
              }))}
            />
          </Field>
          <Field label="Incentive" hint="(optional)">
            <Select
              value={incentive}
              onValueChange={setIncentive}
              options={[
                { value: NONE, label: "None" },
                ...incentives.map((i) => ({ value: i.id, label: i.name, icon: <Gift /> })),
              ]}
            />
          </Field>
        </div>
        {error?.field === "form" ? <Callout tone="danger">{error.message}</Callout> : null}
      </DialogBody>
      <DialogFooter>
        <Button onClick={() => onOpenChange(false)} kbd="Esc">
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={create.isPending} disabled={disabled} kbd="↵">
          Create Account
        </Button>
      </DialogFooter>
    </form>
  );
}
