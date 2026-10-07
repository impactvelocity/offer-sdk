"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  ChartColumn,
  CircleAlert,
  Code,
  Ellipsis,
  Gift,
  Hash,
  KeyRound,
  Layers,
  Pencil,
  SearchX,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AccessTab } from "@/components/accounts/access-tab";
import { ActivityTab } from "@/components/accounts/activity-tab";
import { AnalyticsTab } from "@/components/accounts/analytics-tab";
import { ApiResponseTab } from "@/components/accounts/api-response-tab";
import { ChangePlanDialog } from "@/components/accounts/change-plan-dialog";
import { RefChip } from "@/components/accounts/ref-chips";
import { RenameAccountDialog } from "@/components/accounts/rename-account-dialog";
import { UsageSimulator } from "@/components/accounts/usage-simulator";
import { InlineEdit } from "@/components/catalog/inline-edit";
import { PanelSection, RecordHeader, RecordLayout } from "@/components/catalog/record";
import { PageHeader } from "@/components/shell/page";
import { Avatar } from "@/components/ui/avatar";
import { IdTag } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Property, PropertyList } from "@/components/ui/property-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Tab, Tabs, TabsList, TabsPanel } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { ApiError, api } from "@/lib/api/client";
import {
  keys,
  useAccount,
  useAddons,
  useApiMutation,
  useAppId,
  useEntitlements,
  useIncentives,
  usePlans,
  useResolvedAccess,
} from "@/lib/api/hooks";
import { formatDate } from "@/lib/utils";

type DialogKind = "plan" | "incentive" | "rename";

export function AccountDetail({ accountId }: { accountId: string }) {
  const appId = useAppId();
  const router = useRouter();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data: account, isLoading, error, refetch } = useAccount(appId, accountId);
  const plans = usePlans(appId);
  const incentives = useIncentives(appId);
  const { data: entitlements = [] } = useEntitlements(appId);
  const { data: addons = [] } = useAddons(appId);
  const resolved = useResolvedAccess(appId, accountId, { enabled: Boolean(account) });
  const [dialog, setDialog] = useState<DialogKind | null>(null);

  const plan = plans.data?.find((p) => p.id === account?.plan);
  const incentive = account?.incentive ? incentives.data?.find((i) => i.id === account.incentive) : undefined;
  const planMissing =
    (resolved.error instanceof ApiError && resolved.error.status === 404 && /plan/i.test(resolved.error.message)) ||
    (Boolean(account) && plans.isSuccess && !plan);

  const entitlementNames = useMemo(
    () =>
      new Map([
        ...(resolved.data?.entitlements.map((e) => [e.id, e.name] as const) ?? []),
        ...entitlements.map((e) => [e.id, e.name] as const),
      ]),
    [resolved.data, entitlements],
  );
  const usageEntitlements = useMemo(
    () => resolved.data?.entitlements.filter((e) => e.type === "usage") ?? [],
    [resolved.data],
  );

  const update = useApiMutation((patch: { name: string }) => api.accounts.update(appId, accountId, patch), {
    success: "Account renamed",
  });
  const removeIncentive = useApiMutation(() => api.accounts.removeIncentive(appId, accountId), {
    success: "Incentive removed",
  });
  const remove = useApiMutation(() => api.accounts.delete(appId, accountId), {
    success: "Account deleted",
    // Leave this page's own queries alone so it doesn't flash "not found" before navigating.
    invalidate: [
      [...keys.accounts(appId), "list"],
      [...keys.accounts(appId), "count"],
      [...keys.accounts(appId), "palette"],
      keys.plans(appId),
      keys.incentives(appId),
    ],
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.account(appId, accountId), refetchType: "none" });
      router.push(`/apps/${appId}/accounts`);
    },
  });

  const crumbs = [{ label: "Accounts", href: `/apps/${appId}/accounts`, icon: <Users /> }];

  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <>
        <PageHeader crumbs={crumbs} title={notFound ? "Not found" : "Error"} />
        <EmptyState
          icon={notFound ? <SearchX /> : <CircleAlert />}
          title={notFound ? "Account not found" : "Couldn't load this account"}
          description={notFound ? `There's no account with the ID “${accountId}” in this app.` : error.message}
          action={
            notFound ? (
              <Link href={`/apps/${appId}/accounts`} className={buttonVariants({ variant: "primary" })}>
                All Accounts
              </Link>
            ) : (
              <Button onClick={() => refetch()}>Try Again</Button>
            )
          }
        />
      </>
    );
  }

  if (isLoading || !account) {
    return (
      <>
        <PageHeader crumbs={crumbs} title={<Skeleton className="h-4 w-28" />} />
        <div className="flex flex-col gap-3 p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <Skeleton className="h-6 w-56" />
          </div>
          <Skeleton className="h-48" />
        </div>
      </>
    );
  }

  const name = account.name || account.id;
  const incentiveName = incentive?.name ?? account.incentive ?? "";

  const copyId = async () => {
    await navigator.clipboard.writeText(account.id);
    toast.success("Account ID copied");
  };

  const onRemoveIncentive = () =>
    confirm({
      title: `Remove ${incentiveName}?`,
      description: `${name} goes back to ${plan?.name ?? "its plan"}'s limits on your app's next access check.`,
      confirmLabel: "Remove Incentive",
      onConfirm: () => removeIncentive.mutateAsync(),
    });

  const onDelete = () =>
    confirm({
      title: `Delete ${name}?`,
      description:
        "Your app's access checks for this account will fail until it's created again. Its usage counters and history are kept.",
      typeToConfirm: account.id,
      confirmLabel: "Delete Account",
      onConfirm: () => remove.mutateAsync(),
    });

  const planChip = <RefChip kind="plan" appId={appId} id={account.plan} name={plan?.name} loading={plans.isLoading} />;
  const incentiveChip = account.incentive ? (
    <RefChip kind="incentive" appId={appId} id={account.incentive} name={incentive?.name} loading={incentives.isLoading} />
  ) : null;

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={name}
        actions={
          <>
            <Button onClick={() => setDialog("plan")}>
              <Layers />
              Change Plan
            </Button>
            <Menu>
              <MenuTrigger aria-label="More actions" className={buttonVariants({ icon: true })}>
                <Ellipsis />
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem onClick={() => setDialog("rename")}>
                  <Pencil />
                  Rename…
                </MenuItem>
                <MenuItem onClick={() => setDialog("incentive")}>
                  <Gift />
                  {account.incentive ? "Change incentive…" : "Apply incentive…"}
                </MenuItem>
                {account.incentive ? (
                  <MenuItem onClick={onRemoveIncentive}>
                    <X />
                    Remove incentive
                  </MenuItem>
                ) : null}
                <MenuItem onClick={copyId}>
                  <Hash />
                  Copy account ID
                </MenuItem>
                <MenuSeparator />
                <MenuItem tone="danger" onClick={onDelete}>
                  <Trash2 />
                  Delete account
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
              icon={<Avatar name={name} seed={account.id} size="xl" />}
              title={name}
              badges={
                <>
                  {planChip}
                  {incentiveChip}
                </>
              }
              subtitle={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <IdTag>{account.id}</IdTag>
                  <span>·</span>
                  <span>Joined {formatDate(account.created_at)}</span>
                </span>
              }
            />
            <Tabs defaultValue="access" className="flex flex-1 flex-col">
              <TabsList>
                <Tab value="access" icon={<KeyRound />}>
                  Access
                </Tab>
                <Tab value="activity" icon={<Activity />}>
                  Activity
                </Tab>
                <Tab value="analytics" icon={<ChartColumn />}>
                  Analytics
                </Tab>
                <Tab value="api" icon={<Code />}>
                  API response
                </Tab>
              </TabsList>
              <TabsPanel value="access" className="flex flex-col gap-5 px-8 py-6">
                <AccessTab
                  appId={appId}
                  planId={account.plan}
                  resolved={resolved.data}
                  loading={resolved.isLoading}
                  error={resolved.error}
                  planMissing={planMissing}
                  plan={plan}
                  incentive={incentive}
                  entitlements={entitlements}
                  addons={addons}
                  onChangePlan={() => setDialog("plan")}
                />
              </TabsPanel>
              <TabsPanel value="activity">
                <ActivityTab appId={appId} accountId={account.id} entitlementNames={entitlementNames} />
              </TabsPanel>
              <TabsPanel value="analytics">
                <AnalyticsTab appId={appId} accountId={account.id} entitlementNames={entitlementNames} />
              </TabsPanel>
              <TabsPanel value="api">
                <ApiResponseTab appId={appId} accountId={account.id} />
              </TabsPanel>
            </Tabs>
          </>
        }
        panel={
          <>
            <PanelSection title="Details">
              <PropertyList>
                <Property icon={<Tag />} label="Name">
                  <InlineEdit
                    value={account.name}
                    required
                    placeholder="Add a name"
                    onSave={(next) => update.mutate({ name: next })}
                  />
                </Property>
                <Property icon={<Hash />} label="Account ID">
                  <span className="flex items-center gap-1">
                    <code className="truncate text-xs">{account.id}</code>
                    <CopyButton value={account.id} label="Copy ID" />
                  </span>
                </Property>
                <Property icon={<Layers />} label="Plan">
                  {planChip}
                </Property>
                <Property icon={<Gift />} label="Incentive">
                  {incentiveChip ?? (
                    <span className="flex items-center gap-2">
                      <span className="text-fg-placeholder">None</span>
                      <Button variant="link" onClick={() => setDialog("incentive")}>
                        Apply
                      </Button>
                    </span>
                  )}
                </Property>
                <Property icon={<CalendarDays />} label="Joined">
                  <Tooltip
                    content={new Date(account.created_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}
                  >
                    <span>{formatDate(account.created_at)}</span>
                  </Tooltip>
                </Property>
              </PropertyList>
            </PanelSection>
            <PanelSection title="Usage simulator">
              <UsageSimulator
                appId={appId}
                accountId={account.id}
                entitlements={usageEntitlements}
                unavailable={
                  planMissing
                    ? "Unavailable until the account is on a plan that exists."
                    : resolved.isLoading
                      ? "Loading…"
                      : undefined
                }
              />
            </PanelSection>
          </>
        }
      />
      <ChangePlanDialog
        appId={appId}
        account={account}
        open={dialog === "plan" || dialog === "incentive"}
        focus={dialog === "incentive" ? "incentive" : "plan"}
        onOpenChange={(o) => !o && setDialog(null)}
      />
      <RenameAccountDialog
        appId={appId}
        account={account}
        open={dialog === "rename"}
        onOpenChange={(o) => !o && setDialog(null)}
      />
    </>
  );
}
