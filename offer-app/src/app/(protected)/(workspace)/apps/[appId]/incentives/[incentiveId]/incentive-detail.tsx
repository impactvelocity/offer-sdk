"use client";

import { CalendarDays, Copy, Ellipsis, FileText, Gift, Hash, KeyRound, Layers, SearchX, Tag, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AddonsEditor, EntitlementsEditor } from "@/components/catalog/attachments";
import { IncentiveDialog } from "@/components/catalog/dialogs";
import { InlineEdit } from "@/components/catalog/inline-edit";
import { LinkedAccounts } from "@/components/catalog/linked-accounts";
import { PanelSection, RecordHeader, RecordIcon, RecordLayout } from "@/components/catalog/record";
import { ApplyToAccount } from "@/components/incentives/apply-to-account";
import { ImpactByPlan } from "@/components/incentives/overrides";
import { useDeleteIncentive } from "@/components/incentives/use-delete-incentive";
import { PageHeader } from "@/components/shell/page";
import { Chip, IdTag } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Property, PropertyList } from "@/components/ui/property-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Tab, Tabs, TabsList, TabsPanel } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import {
  useAddons,
  useApiMutation,
  useAppId,
  useEntitlements,
  useIncentive,
  useIncentiveAccounts,
  usePlans,
} from "@/lib/api/hooks";
import { formatDate, pluralize } from "@/lib/utils";

const PER_PAGE = 20;

export function IncentiveDetail({ incentiveId }: { incentiveId: string }) {
  const appId = useAppId();
  const router = useRouter();
  const { data: incentive, isLoading, error } = useIncentive(appId, incentiveId);
  const { data: entitlements = [] } = useEntitlements(appId);
  const { data: addons = [] } = useAddons(appId);
  const plans = usePlans(appId);
  const [page, setPage] = useState(1);
  const accounts = useIncentiveAccounts(appId, incentiveId, page, PER_PAGE);
  const [duplicating, setDuplicating] = useState(false);

  const update = useApiMutation(
    (patch: { name?: string; description?: string | null }) => api.incentives.update(appId, incentiveId, patch),
    { success: "Incentive updated" },
  );
  const onDelete = useDeleteIncentive(appId, { onDeleted: () => router.push(`/apps/${appId}/incentives`) });

  const accountTotal = accounts.data?.total ?? 0;
  const planName = useMemo(() => new Map(plans.data?.map((p) => [p.id, p.name])), [plans.data]);
  const accountPlan = useMemo(() => new Map(accounts.data?.data.map((a) => [a.id, a.plan])), [accounts.data]);

  const crumbs = [{ label: "Incentives", href: `/apps/${appId}/incentives`, icon: <Gift /> }];

  // Keep showing the record if a refetch fails after we had it (e.g. right after deleting it).
  if (error && !incentive) {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Not found" />
        <EmptyState
          icon={<SearchX />}
          title="Incentive not found"
          description={`There's no incentive with the ID “${incentiveId}” in this app.`}
          action={
            <Link href={`/apps/${appId}/incentives`} className={buttonVariants({ variant: "primary" })}>
              All incentives
            </Link>
          }
        />
      </>
    );
  }

  if (isLoading || !incentive) {
    return (
      <>
        <PageHeader crumbs={crumbs} title={<Skeleton className="h-4 w-24" />} />
        <div className="flex flex-col gap-3 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48" />
        </div>
      </>
    );
  }

  const owner = {
    kind: "incentives" as const,
    id: incentive.id,
    name: incentive.name,
    entitlements: incentive.entitlements,
    addons: incentive.addons,
  };

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={incentive.name}
        actions={
          <>
            <Link href={`/apps/${appId}/accounts?incentive=${incentive.id}`} className={buttonVariants()}>
              <Users />
              List All Accounts
            </Link>
            <Button onClick={() => setDuplicating(true)}>
              <Copy />
              Duplicate
            </Button>
            <Menu>
              <MenuTrigger aria-label="More actions" className={buttonVariants({ icon: true })}>
                <Ellipsis />
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem onClick={() => navigator.clipboard.writeText(incentive.id)}>
                  <Hash />
                  Copy incentive ID
                </MenuItem>
                <MenuItem onClick={() => router.push(`/apps/${appId}/accounts?incentive=${incentive.id}`)}>
                  <Users />
                  View accounts
                </MenuItem>
                <MenuSeparator />
                <MenuItem tone="danger" onClick={() => onDelete(incentive, accountTotal)}>
                  <Trash2 />
                  Delete incentive
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
              icon={
                <RecordIcon tone="orange">
                  <Gift />
                </RecordIcon>
              }
              title={incentive.name}
              subtitle={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <IdTag>{incentive.id}</IdTag>
                  <span>·</span>
                  <span>{accounts.data ? pluralize(accountTotal, "account") : "— accounts"}</span>
                </span>
              }
            />
            <Tabs defaultValue="overrides" className="flex flex-1 flex-col">
              <TabsList>
                <Tab value="overrides" icon={<KeyRound />} count={incentive.entitlements.length + incentive.addons.length}>
                  Overrides
                </Tab>
                <Tab value="accounts" icon={<Users />} count={accounts.data ? accountTotal : null}>
                  Accounts
                </Tab>
              </TabsList>
              <TabsPanel value="overrides" className="flex flex-col gap-5 px-8 py-6">
                <EntitlementsEditor appId={appId} catalog={entitlements} owner={owner} />
                <AddonsEditor appId={appId} catalog={addons} owner={owner} />
                <ImpactByPlan
                  appId={appId}
                  incentive={incentive}
                  plans={plans.data ?? []}
                  entitlements={entitlements}
                  addons={addons}
                  loading={plans.isLoading}
                />
              </TabsPanel>
              <TabsPanel value="accounts">
                <LinkedAccounts
                  appId={appId}
                  rows={accounts.data?.data}
                  total={accountTotal}
                  page={page}
                  perPage={PER_PAGE}
                  onPageChange={setPage}
                  loading={accounts.isLoading}
                  emptyTitle="No accounts have this incentive"
                  emptyDescription="Apply it to an account from the panel on the right, from an account's page, or from your backend via the API."
                  extraColumn={{
                    header: "Plan",
                    cell: (row) => {
                      const plan = accountPlan.get(row.id);
                      return plan ? <Chip icon={<Layers />}>{planName.get(plan) ?? plan}</Chip> : null;
                    },
                  }}
                />
              </TabsPanel>
            </Tabs>
          </>
        }
        panel={
          <>
            <PanelSection title="Details">
              <PropertyList>
                <Property icon={<Tag />} label="Name">
                  <InlineEdit value={incentive.name} required onSave={(name) => update.mutate({ name })} />
                </Property>
                <Property icon={<FileText />} label="Description">
                  <InlineEdit
                    value={incentive.description}
                    multiline
                    placeholder="Add a description"
                    onSave={(description) => update.mutate({ description: description || null })}
                  />
                </Property>
                <Property icon={<Hash />} label="Incentive ID">
                  <span className="flex items-center gap-1">
                    <code className="truncate text-xs">{incentive.id}</code>
                    <CopyButton value={incentive.id} label="Copy ID" />
                  </span>
                </Property>
                <Property icon={<CalendarDays />} label="Created">
                  {formatDate(incentive.created_at)}
                </Property>
              </PropertyList>
            </PanelSection>
            <PanelSection title="Apply to an account">
              <ApplyToAccount appId={appId} incentive={incentive} />
            </PanelSection>
          </>
        }
      />
      <IncentiveDialog appId={appId} open={duplicating} onOpenChange={setDuplicating} source={duplicating ? incentive : null} />
    </>
  );
}
