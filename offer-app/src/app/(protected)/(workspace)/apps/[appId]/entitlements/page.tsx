import type { Metadata } from "next";
import { EntitlementsView } from "./entitlements-view";

export const metadata: Metadata = { title: "Entitlements" };

export default function EntitlementsPage() {
  return <EntitlementsView />;
}
