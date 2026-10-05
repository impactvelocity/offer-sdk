import type { Metadata } from "next";
import { IncentiveDetail } from "./incentive-detail";

export const metadata: Metadata = { title: "Incentive" };

export default async function IncentivePage({ params }: PageProps<"/apps/[appId]/incentives/[incentiveId]">) {
  const { incentiveId } = await params;
  return <IncentiveDetail incentiveId={decodeURIComponent(incentiveId)} />;
}
