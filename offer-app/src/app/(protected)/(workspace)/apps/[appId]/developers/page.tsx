import type { Metadata } from "next";
import { IntegrationView } from "./integration-view";

export const metadata: Metadata = { title: "Integration" };

export default function IntegrationPage() {
  return <IntegrationView />;
}
