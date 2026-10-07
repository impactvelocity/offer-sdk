import type { Metadata } from "next";
import { CancelFlowView } from "@/components/cancel-flows/cancel-flow-view";

export const metadata: Metadata = { title: "Cancel Flow" };

export default function CancelFlowPage() {
  return <CancelFlowView />;
}
