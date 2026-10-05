import type { Metadata } from "next";
import { PlanDetail } from "./plan-detail";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage({ params }: PageProps<"/apps/[appId]/plans/[planId]">) {
  const { planId } = await params;
  return <PlanDetail planId={decodeURIComponent(planId)} />;
}
