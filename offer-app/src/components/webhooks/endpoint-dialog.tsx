"use client";

import { Pencil, Webhook } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { useApiMutation } from "@/lib/api/hooks";
import type { WebhookEndpoint } from "@/lib/api/types";
import { EventPicker } from "./event-picker";

/** Client-side check before the API's own validation. */
export function urlProblem(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return "Use an http(s) URL.";
    return null;
  } catch {
    return "Enter a full URL, including https://";
  }
}

/** Create a custom endpoint, or edit one when `endpoint` is set. */
export function EndpointDialog({
  open,
  onOpenChange,
  appId,
  endpoint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  endpoint?: WebhookEndpoint | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <EndpointForm appId={appId} endpoint={endpoint} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EndpointForm({ appId, endpoint, onClose }: { appId: string; endpoint?: WebhookEndpoint | null; onClose: () => void }) {
  const router = useRouter();
  const editing = Boolean(endpoint);
  const [url, setUrl] = useState(endpoint?.url ?? "");
  const [description, setDescription] = useState(endpoint?.description ?? "");
  const [events, setEvents] = useState<string[]>(endpoint?.events ?? ["*"]);
  const [touched, setTouched] = useState(false);

  const problem = urlProblem(url);
  const insecure = !problem && url.trim().startsWith("http://");

  const save = useApiMutation(
    () => {
      const input = { url: url.trim(), events, description: description.trim() || null };
      return editing ? api.webhooks.update(appId, endpoint!.id, input) : api.webhooks.create(appId, input);
    },
    {
      success: editing ? "Endpoint updated" : "Endpoint added",
      onSuccess: (created) => {
        onClose();
        if (!editing) router.push(`/apps/${appId}/developers/webhooks/${created.id}`);
      },
    },
  );

  const disabled = !url.trim() || Boolean(problem) || events.length === 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!disabled) save.mutate();
  };

  return (
    <form onSubmit={submit}>
      <DialogHeader icon={editing ? <Pencil /> : <Webhook />} title={editing ? "Edit endpoint" : "Add webhook endpoint"} />
      <DialogBody>
        {!editing ? (
          <p className="-mt-1 text-sm text-fg-tertiary">
            We&apos;ll POST a signed JSON payload to this URL whenever a selected event happens, and retry for up to a day if
            it doesn&apos;t answer with a 2xx.
          </p>
        ) : null}
        <Field
          label="Endpoint URL"
          error={touched ? problem : null}
          description={insecure ? "Plain http works for testing; use https in production." : undefined}
        >
          <Input
            autoFocus={!editing}
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="https://api.example.com/webhooks/offer"
            className="font-mono text-[13.5px]"
          />
        </Field>
        <Field label="Description" hint="(optional)">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Billing service" />
        </Field>
        <Field label="Events to send">
          <EventPicker value={events} onChange={setEvents} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose} kbd="Esc">
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={save.isPending} disabled={disabled} kbd="↵">
          {editing ? "Save changes" : "Add endpoint"}
        </Button>
      </DialogFooter>
    </form>
  );
}
