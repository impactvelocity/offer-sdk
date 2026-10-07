"use client";

import { BadgePercent, Braces, ChartColumn, Code, DoorOpen, Gift, House, Key, KeyRound, Layers, Plug, Puzzle, Settings, Sparkles, Users, Webhook } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAccountCount, useAddons, useApp, useCancelFlows, useEntitlements, useIncentives, useOffers, usePlans, useWebhooks } from "@/lib/api/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickActionsButton } from "./quick-actions";
import { useIsDemo } from "./workspace-context";
import { NavGroup, NavItem, NavPanel, NavPanelBody, NavPanelFooter, NavPanelHeader } from "./sidebar";

/** Nav panel for one app: its catalog, customers and developer tools. */
export function AppNav({ appId, className }: { appId: string; className?: string }) {
  const pathname = usePathname();
  const demo = useIsDemo();
  const base = `/apps/${appId}`;
  const is = (path: string, exact = false) =>
    exact ? pathname === `${base}${path}` : pathname === `${base}${path}` || pathname.startsWith(`${base}${path}/`);

  const { data: app } = useApp(appId);
  const plans = usePlans(appId);
  const entitlements = useEntitlements(appId);
  const addons = useAddons(appId);
  const incentives = useIncentives(appId);
  const offers = useOffers(appId);
  const cancelFlows = useCancelFlows(appId);
  const accounts = useAccountCount(appId);
  const webhooks = useWebhooks(appId);

  return (
    <NavPanel className={className}>
      <NavPanelHeader title={app?.name ?? <Skeleton className="h-4 w-28" />} />
      <NavPanelBody>
        <div className="flex flex-col gap-0.5">
          <div className="mb-3">
            <QuickActionsButton />
          </div>
          <NavItem href={base} icon={<House />} active={pathname === base}>
            Overview
          </NavItem>
          <NavItem href={`${base}/analytics`} icon={<ChartColumn />} active={is("/analytics")}>
            Analytics
          </NavItem>
          {/* Off on the shared demo login (see @/lib/demo). */}
          {demo ? null : (
            <NavItem href={`${base}/agent`} icon={<Sparkles />} active={is("/agent")}>
              Agent
            </NavItem>
          )}
          {/* Hidden on API versions without offers (the in-memory mock). */}
          {offers.data !== null ? (
            <NavItem href={`${base}/offers`} icon={<BadgePercent />} active={is("/offers")} count={offers.data?.length}>
              Offers
            </NavItem>
          ) : null}
          {cancelFlows.data !== null ? (
            <NavItem href={`${base}/cancel-flow`} icon={<DoorOpen />} active={is("/cancel-flow")}>
              Cancel Flow
            </NavItem>
          ) : null}
        </div>

        <NavGroup label="Catalog">
          <NavItem href={`${base}/plans`} icon={<Layers />} active={is("/plans")} count={plans.data?.length}>
            Plans
          </NavItem>
          <NavItem href={`${base}/entitlements`} icon={<KeyRound />} active={is("/entitlements")} count={entitlements.data?.length}>
            Entitlements
          </NavItem>
          <NavItem href={`${base}/addons`} icon={<Puzzle />} active={is("/addons")} count={addons.data?.length}>
            Add-ons
          </NavItem>
          <NavItem href={`${base}/incentives`} icon={<Gift />} active={is("/incentives")} count={incentives.data?.length}>
            Incentives
          </NavItem>
        </NavGroup>

        <NavGroup label="Customers">
          <NavItem href={`${base}/accounts`} icon={<Users />} active={is("/accounts")} count={accounts.data?.count}>
            Accounts
          </NavItem>
        </NavGroup>

        <NavGroup label="Developers">
          <NavItem href={`${base}/developers`} icon={<Code />} active={is("/developers", true)}>
            Integration
          </NavItem>
          <NavItem href={`${base}/developers/api`} icon={<Braces />} active={is("/developers/api")}>
            API Reference
          </NavItem>
          <NavItem href={`${base}/developers/mcp`} icon={<Plug />} active={is("/developers/mcp")}>
            MCP Server
          </NavItem>
          <NavItem href={`${base}/developers/keys`} icon={<Key />} active={is("/developers/keys")}>
            API Keys
          </NavItem>
          <NavItem href={`${base}/developers/webhooks`} icon={<Webhook />} active={is("/developers/webhooks")} count={webhooks.data?.length}>
            Webhooks
          </NavItem>
        </NavGroup>
      </NavPanelBody>
      <NavPanelFooter>
        <NavItem href={`${base}/settings`} icon={<Settings />} active={is("/settings")}>
          App Settings
        </NavItem>
      </NavPanelFooter>
    </NavPanel>
  );
}
