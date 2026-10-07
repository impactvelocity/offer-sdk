"use client";

import { DoorOpen } from "lucide-react";
import Link from "next/link";
import { CancelFlowEditor } from "@/components/cancel-flows/cancel-flow-editor";
import { PageHeader } from "@/components/shell/page";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppId, useCancelFlow, useCancelFlows } from "@/lib/api/hooks";

export function EditCancelFlow() {
  const appId = useAppId();
  const flows = useCancelFlows(appId);
  const id = flows.data?.find((f) => f.id === "default")?.id ?? flows.data?.[0]?.id;
  // Fetched on its own for the API's capabilities (dynamic offers, workflows).
  const flow = useCancelFlow(appId, id);
  const crumbs = [{ label: "Cancel flow", href: `/apps/${appId}/cancel-flow`, icon: <DoorOpen /> }];

  if (flows.isLoading || flow.isLoading) {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Edit" />
        <div className="flex flex-col gap-3 p-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }
  if (!flow.data) {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Edit" />
        <EmptyState
          icon={<DoorOpen />}
          title="No cancel flow yet"
          description="Create one from the template first."
          action={
            <Link href={`/apps/${appId}/cancel-flow`} className={buttonVariants({ variant: "primary" })}>
              Set up a cancel flow
            </Link>
          }
        />
      </>
    );
  }
  return <CancelFlowEditor key={flow.data.updated_at} appId={appId} flow={flow.data} />;
}
