import type { Metadata } from "next";
import { IncentivesView } from "./incentives-view";

export const metadata: Metadata = { title: "Incentives" };

export default function IncentivesPage() {
  return <IncentivesView />;
}
