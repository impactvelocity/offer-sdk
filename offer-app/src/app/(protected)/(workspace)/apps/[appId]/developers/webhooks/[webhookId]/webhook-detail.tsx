"use client";

import {
  ArrowUpRight,
  CalendarDays,
  Copy,
  Ellipsis,
  FileText,
  Hash,
  Link2,
  ListChecks,
  Pause,
  Pencil,
  Play,
  Plug,
  Power,
  RefreshCw,
  SearchX,
  Send,
  Trash2,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { InlineCode, Md } from "@/components/developers/bits";
import { InlineEdit } from "@/components/catalog/inline-edit";
import { PanelSection, RecordHeader, RecordLayout } from "@/components/catalog/record";
import { PageHeader } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Stat } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Property, PropertyList } from "@/components/ui/property-list";
import { SecretInput } from "@/components/ui/secret-input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tab, Tabs, TabsList, TabsPanel } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { keys, useApiMutation, useAppId, useWebhook } from "@/lib/api/hooks";
import type { WebhookEndpoint } from "@/lib/api/types";
import { formatDate } from "@/lib/utils";
import { ALL_EVENTS, WEBHOOK_CATEGORIES, WEBHOOK_EVENTS } from "@/lib/webhooks/catalog";
import { useDeleteEndpoint, useSendTest } from "@/components/webhooks/actions";
import { EndpointIcon, EndpointStatus, endpointName, eventTitle, successRate, ZapierMark } from "@/components/webhooks/bits";
import { EndpointDialog } from "@/components/webhooks/endpoint-dialog";
import { DeliveryLog } from "@/components/webhooks/logs";
import { WEBHOOK_SECRET_ENV } from "@/components/webhooks/reference";

export function WebhookDetail({ webhookId }: { webhookId: string }) {
  const appId = useAppId();
  const router = useRouter();
  const confirm = useConfirm();
  const { data: endpoint, isLoading, error } = useWebhook(appId, webhookId);
  const [editing, setEditing] = useState(false);
  const [testType, setTestType] = useState<string | null>(null);

  const update = useApiMutation(
    (patch: Partial<Pick<WebhookEndpoint, "url" | "description" | "enabled" | "events">>) =>
      api.webhooks.update(appId, webhookId, patch),
    {
      success: (e, patch) =>
        "enabled" in patch ? (e.enabled ? "Endpoint resumed" : "Endpoint paused") : "Endpoint updated",
      invalidate: [keys.webhooks(appId)],
    },
  );
  const roll = useApiMutation(() => api.webhooks.regenerateSecret(appId, webhookId), {
    success: "Signing secret rolled",
    invalidate: [keys.webhook(appId, webhookId)],
  });
  const sendTest = useSendTest(appId);
  const onDelete = useDeleteEndpoint(appId, { onDeleted: () => router.push(`/apps/${appId}/developers/webhooks`) });

  const crumbs = [{ label: "Webhooks", href: `/apps/${appId}/developers/webhooks`, icon: <Webhook /> }];

  if (error && !endpoint) {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Not found" />
        <EmptyState
          icon={<SearchX />}
          title="Endpoint not found"
          description={`There's no webhook endpoint with the ID “${webhookId}” in this app.`}
          action={
            <Link href={`/apps/${appId}/developers/webhooks`} className={buttonVariants({ variant: "primary" })}>
              All webhooks
            </Link>
          }
        />
      </>
    );
  }

  if (isLoading || !endpoint) {
    return (
      <>
        <PageHeader crumbs={crumbs} title={<Skeleton className="h-4 w-32" />} />
        <div className="flex flex-col gap-3 p-6">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-48" />
        </div>
      </>
    );
  }

  const all = endpoint.events.includes(ALL_EVENTS);
  const subscribed = all ? WEBHOOK_EVENTS.map((e) => e.type) : endpoint.events;
  const selectedTest = testType && subscribed.includes(testType) ? testType : subscribed[0];
  const rate = successRate(endpoint.stats);
  const zapier = endpoint.source === "zapier";

  const onRoll = () =>
    confirm({
      title: "Roll the signing secret?",
      description: zapier
        ? "Zapier doesn't check signatures, so your Zap keeps working."
        : `The old secret stops working immediately. Deliveries fail verification until you update ${WEBHOOK_SECRET_ENV} on your server.`,
      confirmLabel: "Roll secret",
      tone: "default",
      onConfirm: () => roll.mutateAsync(),
    });

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={endpointName(endpoint)}
        actions={
          <>
            <Button onClick={() => sendTest.mutate({ endpoint, type: selectedTest })} loading={sendTest.isPending}>
              {sendTest.isPending ? null : <Send />}
              Send test
            </Button>
            <Button onClick={() => setEditing(true)}>
              <Pencil />
              Edit
            </Button>
            <Menu>
              <MenuTrigger aria-label="More actions" className={buttonVariants({ icon: true })}>
                <Ellipsis />
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem onClick={() => navigator.clipboard.writeText(endpoint.url)}>
                  <Copy />
                  Copy URL
                </MenuItem>
                <MenuItem onClick={() => update.mutate({ enabled: !endpoint.enabled })}>
                  {endpoint.enabled ? <Pause /> : <Play />}
                  {endpoint.enabled ? "Pause endpoint" : "Resume endpoint"}
                </MenuItem>
                <MenuSeparator />
                <MenuItem tone="danger" onClick={() => onDelete(endpoint)}>
                  <Trash2 />
                  Delete endpoint
                </MenuItem>
              </MenuContent>
            </Menu>
          </>
        }
      />
      <RecordLayout
        main={
          <>
            <RecordHeader
              icon={<EndpointIcon source={endpoint.source} size="lg" />}
              title={endpointName(endpoint)}
              badges={
                zapier ? (
                  <Badge color="orange" icon={<ZapierMark />}>
                    Zapier
                  </Badge>
                ) : null
              }
              subtitle={
                <span className="flex min-w-0 items-center gap-1">
                  <code className="truncate text-[13px]">{endpoint.url}</code>
                  <CopyButton value={endpoint.url} label="Copy URL" />
                </span>
              }
            />
            {!endpoint.enabled ? (
              <div className="px-8 pb-6">
                <Callout
                  tone={endpoint.disabled_reason ? "danger" : "warning"}
                  title={endpoint.disabled_reason ? "This endpoint was turned off" : "This endpoint is paused"}
                  action={
                    <Button size="xs" variant="secondary" onClick={() => update.mutate({ enabled: true })} loading={update.isPending}>
                      <Power />
                      Resume
                    </Button>
                  }
                >
                  {endpoint.disabled_reason
                    ? `${endpoint.disabled_reason}. New events aren't being sent.`
                    : "New events aren't being sent. Events that happen while paused are not delivered later."}
                </Callout>
              </div>
            ) : null}
            <div className="mx-8 mb-6 grid grid-cols-2 overflow-hidden rounded-lg border border-border sm:grid-cols-4 [&>*]:border-border [&>*:nth-child(odd)]:border-r sm:[&>*]:border-r sm:[&>*:last-child]:border-r-0 [&>*:nth-child(-n+2)]:border-b sm:[&>*:nth-child(-n+2)]:border-b-0">
              <Stat label="Delivered" value={endpoint.stats.succeeded} hint="Last 7 days" />
              <Stat label="Failed" value={endpoint.stats.failed} hint="Last 7 days" />
              <Stat label="Retrying" value={endpoint.stats.pending} hint="Pending now" />
              <Stat label="Success rate" value={rate === null ? "—" : `${rate}%`} hint="Last 7 days" />
            </div>
            <Tabs defaultValue="deliveries" className="flex flex-1 flex-col">
              <TabsList>
                <Tab value="deliveries" icon={<Send />}>
                  Deliveries
                </Tab>
                <Tab value="events" icon={<ListChecks />} count={all ? null : endpoint.events.length}>
                  Events
                </Tab>
              </TabsList>
              <TabsPanel value="deliveries">
                <DeliveryLog appId={appId} endpointId={endpoint.id} />
              </TabsPanel>
              <TabsPanel value="events" className="px-8 py-6">
                <SubscribedEvents endpoint={endpoint} onEdit={() => setEditing(true)} />
              </TabsPanel>
            </Tabs>
          </>
        }
        panel={
          <>
            <PanelSection title="Details">
              <PropertyList>
                <Property icon={<Link2 />} label="URL">
                  <InlineEdit value={endpoint.url} required onSave={(url) => update.mutate({ url: url.trim() })} />
                </Property>
                <Property icon={<FileText />} label="Description">
                  <InlineEdit
                    value={endpoint.description}
                    placeholder="Add a description"
                    onSave={(description) => update.mutate({ description: description || null })}
                  />
                </Property>
                <Property icon={<Power />} label="Status">
                  <span className="flex items-center gap-3">
                    <Switch
                      checked={endpoint.enabled}
                      onCheckedChange={(enabled) => update.mutate({ enabled })}
                      aria-label="Enabled"
                    />
                    <EndpointStatus endpoint={endpoint} />
                  </span>
                </Property>
                <Property icon={<Plug />} label="Source">
                  {zapier ? (
                    <span className="inline-flex items-center gap-1.5">
                      <ZapierMark />
                      Zapier
                    </span>
                  ) : (
                    "Custom endpoint"
                  )}
                </Property>
                <Property icon={<Hash />} label="Endpoint ID">
                  <span className="flex items-center gap-1">
                    <code className="truncate text-xs">{endpoint.id}</code>
                    <CopyButton value={endpoint.id} label="Copy ID" />
                  </span>
                </Property>
                <Property icon={<CalendarDays />} label="Created">
                  {formatDate(endpoint.created_at)}
                </Property>
              </PropertyList>
            </PanelSection>
            <PanelSection
              title="Signing secret"
              actions={
                <Button size="xs" variant="ghost" onClick={onRoll} loading={roll.isPending}>
                  {roll.isPending ? null : <RefreshCw />}
                  Roll
                </Button>
              }
            >
              <SecretInput key={endpoint.secret} value={endpoint.secret} />
              <p className="mt-2 text-xs text-fg-tertiary">
                {zapier ? (
                  "Every delivery is signed. Zapier doesn't verify signatures, so you can ignore this unless you forward events elsewhere."
                ) : (
                  <>
                    Store it as <InlineCode>{WEBHOOK_SECRET_ENV}</InlineCode> and verify the <InlineCode>webhook-signature</InlineCode>{" "}
                    header on every request.
                  </>
                )}
              </p>
            </PanelSection>
            <PanelSection title="Send a test event">
              <div className="flex flex-col gap-2">
                <Select
                  value={selectedTest}
                  onValueChange={setTestType}
                  aria-label="Test event type"
                  options={subscribed.map((type) => ({ value: type, label: eventTitle(type), description: type }))}
                />
                <Button
                  onClick={() => sendTest.mutate({ endpoint, type: selectedTest })}
                  loading={sendTest.isPending}
                  className="w-full"
                >
                  {sendTest.isPending ? null : <Send />}
                  Send sample payload
                </Button>
                <p className="text-xs text-fg-tertiary">
                  Marked <InlineCode>&quot;test&quot;: true</InlineCode>. {zapier ? "Use it with Zapier's Test trigger to map fields." : "It shows up in the delivery log."}
                </p>
              </div>
            </PanelSection>
            {zapier ? (
              <PanelSection title="Zapier">
                <p className="text-sm text-fg-secondary">
                  Turning the Zap off or deleting it makes Zapier answer <InlineCode>410 Gone</InlineCode>, and this endpoint
                  turns itself off. Turn the Zap back on, then resume the endpoint here.
                </p>
                <a href="https://zapier.com/app/zaps" target="_blank" rel="noreferrer" className={buttonVariants({ size: "xs", className: "mt-3" })}>
                  <ZapierMark className="size-3.5" />
                  Open my Zaps
                  <ArrowUpRight />
                </a>
              </PanelSection>
            ) : null}
          </>
        }
      />
      <EndpointDialog appId={appId} open={editing} onOpenChange={setEditing} endpoint={endpoint} />
    </>
  );
}

function SubscribedEvents({ endpoint, onEdit }: { endpoint: WebhookEndpoint; onEdit: () => void }) {
  const all = endpoint.events.includes(ALL_EVENTS);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-tertiary">
          {all ? "Subscribed to every event, including types added later." : "Only these events are sent to this endpoint."}
        </p>
        <Button size="xs" onClick={onEdit}>
          <Pencil />
          Edit events
        </Button>
      </div>
      {WEBHOOK_CATEGORIES.map((category) => {
        const types = WEBHOOK_EVENTS.filter((e) => e.category === category.id && (all || endpoint.events.includes(e.type)));
        if (!types.length) return null;
        return (
          <div key={category.id}>
            <h3 className="mb-2 text-sm font-semibold text-fg">{category.title}</h3>
            <div className="overflow-hidden rounded-lg border border-border">
              {types.map((t) => (
                <div key={t.type} className="flex flex-col gap-0.5 border-b border-border px-4 py-2.5 last:border-b-0">
                  <code className="text-[13px] text-fg">{t.type}</code>
                  <span className="text-sm text-fg-tertiary">
                    <Md>{t.description}</Md>
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
