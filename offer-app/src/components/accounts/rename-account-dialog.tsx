"use client";

import { Pencil } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { useApiMutation } from "@/lib/api/hooks";
import type { AccountRef } from "./change-plan-dialog";

interface Props {
  appId: string;
  account: AccountRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameAccountDialog({ open, onOpenChange, ...props }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <RenameForm {...props} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({ appId, account, onOpenChange }: Omit<Props, "open">) {
  const [name, setName] = useState(account.name ?? "");

  const rename = useApiMutation(() => api.accounts.update(appId, account.id, { name: name.trim() }), {
    success: "Account renamed",
    onSuccess: () => onOpenChange(false),
  });

  const disabled = !name.trim() || name.trim() === account.name;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled && !rename.isPending) rename.mutate();
  };

  return (
    <form onSubmit={submit}>
      <DialogHeader icon={<Pencil />} title="Rename account" />
      <DialogBody>
        <Field label="Name" description={`The ID stays ${account.id}.`}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button onClick={() => onOpenChange(false)} kbd="Esc">
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={rename.isPending} disabled={disabled} kbd="↵">
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
