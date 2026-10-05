"use client";

import { Activity, History } from "lucide-react";
import { ActivityFeed } from "@/components/analytics/activity-feed";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsageEvents } from "@/lib/api/hooks";
import { Callout } from "@/components/ui/callout";

export function ActivityTab({
  appId,
  accountId,
  entitlementNames,
}: {
  appId: string;
  accountId: string;
  entitlementNames: Map<string, string>;
}) {
  const { data: events, isLoading, error } = useUsageEvents(appId, { namespace: accountId, limit: 50 });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-6">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-8 py-6">
        <Callout tone="danger">Couldn&apos;t load activity: {error.message}</Callout>
      </div>
    );
  }
  if (events === null || events === undefined) {
    return (
      <EmptyState
        compact
        icon={<History />}
        title="Activity isn't available yet"
        description="The hosted API doesn't expose individual usage events yet. Totals per entitlement are on the Analytics tab."
      />
    );
  }
  if (!events.length) {
    return (
      <EmptyState
        compact
        icon={<Activity />}
        title="No usage yet"
        description="Tracking calls your app makes for this account (add, remove, amount) show up here. Try the usage simulator to send one."
      />
    );
  }
  return (
    <div className="px-8 py-6">
      <ActivityFeed appId={appId} events={events} entitlements={entitlementNames} showAccount={false} />
      {events.length >= 50 ? <p className="mt-4 text-xs text-fg-tertiary">Showing the 50 most recent events.</p> : null}
    </div>
  );
}
