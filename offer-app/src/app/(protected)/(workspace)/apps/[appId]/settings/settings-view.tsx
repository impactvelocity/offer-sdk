"use client";

import { ChevronRight, Code, Key, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CopyField } from "@/components/developers/bits";
import { PaymentsSettings } from "@/components/offers/payments-settings";
import { Callout } from "@/components/ui/callout";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { keys, useApiMutation, useApp, useAppId } from "@/lib/api/hooks";
import type { App } from "@/lib/api/types";
import { formatDate } from "@/lib/utils";

export function SettingsView() {
  const appId = useAppId();
  const { data: app, isLoading, error } = useApp(appId);

  return (
    <>
      <PageHeader icon={<Settings />} title="App settings" />
      <PageBody width="narrow">
        <PageTitle title="App settings" description={app ? `Manage ${app.name}` : "Manage this app"} />
        {isLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error || !app ? (
          <Callout tone="danger" title="Couldn't load this app">
            {error?.message}
          </Callout>
        ) : (
          <div>
            {/* Remount on rename so the field resets to the saved name. */}
            <General key={app.name} app={app} />
            <PaymentsSettings app={app} />
            <Section title="Developers" description="Connect your product to this app.">
              <div className="overflow-hidden rounded-lg border border-border">
                <LinkRow
                  href={`/apps/${appId}/developers/keys`}
                  icon={<Key />}
                  title="API keys"
                  description="View and regenerate the secret and public keys"
                />
                <LinkRow
                  href={`/apps/${appId}/developers`}
                  icon={<Code />}
                  title="Integration guide"
                  description="Snippets for accounts, access checks, usage and pricing"
                />
              </div>
            </Section>
            <DangerZone app={app} />
          </div>
        )}
      </PageBody>
    </>
  );
}

function General({ app }: { app: App }) {
  const [name, setName] = useState(app.name);
  const trimmed = name.trim();
  const dirty = trimmed !== app.name;

  const rename = useApiMutation((next: string) => api.apps.update(app.id, { name: next }), {
    success: "App renamed",
    invalidate: [keys.apps, keys.app(app.id)],
  });

  return (
    <Section title="General">
      <div className="flex flex-col gap-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty && trimmed) rename.mutate(trimmed);
          }}
        >
          <Field label="App name" description="Shown in the dashboard. Your end customers never see it." error={!trimmed ? "Name is required" : undefined}>
            <div className="flex gap-2">
              <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
              <Button type="submit" variant="primary" size="md" disabled={!dirty || !trimmed} loading={rename.isPending}>
                Save
              </Button>
            </div>
          </Field>
        </form>
        <Field label="App ID" description={`Part of every API path: /apps/${app.id}/…`}>
          <CopyField value={app.id} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg-secondary">Created</span>
          <span className="text-sm text-fg">{formatDate(app.created_at)}</span>
        </div>
      </div>
    </Section>
  );
}

function LinkRow({ href, icon, title, description }: { href: string; icon: ReactNode; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b border-border px-4 py-3 outline-none transition-colors last:border-b-0 hover:bg-bg-subtle focus-visible:bg-bg-subtle"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-bg-muted text-fg-secondary [&_svg]:size-3.5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="block truncate text-xs text-fg-tertiary">{description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-fg-tertiary" />
    </Link>
  );
}

function DangerZone({ app }: { app: App }) {
  const router = useRouter();
  const confirm = useConfirm();
  const remove = useApiMutation(() => api.apps.delete(app.id), {
    success: `${app.name} deleted`,
    // Only the app list: refetching this app's own queries would 404 before we navigate away.
    invalidate: [keys.apps],
    onSuccess: () => router.push("/apps"),
  });

  const onDelete = () =>
    confirm({
      title: `Delete ${app.name}?`,
      description:
        "This permanently deletes the app and everything in it: plans, entitlements, add-ons, incentives, accounts and usage history. Your product's API calls start failing immediately. This can't be undone.",
      typeToConfirm: app.name,
      confirmLabel: "Delete app",
      onConfirm: () => remove.mutateAsync(),
    });

  return (
    <Section title="Danger zone">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-danger/30 px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">Delete app</p>
          <p className="mt-0.5 text-sm text-fg-tertiary">
            Permanently delete {app.name}, its catalog, accounts and usage history.
          </p>
        </div>
        <Button variant="danger" onClick={onDelete}>
          <Trash2 />
          Delete app
        </Button>
      </div>
    </Section>
  );
}
