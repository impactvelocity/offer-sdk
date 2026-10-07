import type { Metadata } from "next";
import { readSdkFiles } from "@/server/sdk-source";
import { IntegrationView } from "./integration-view";

export const metadata: Metadata = { title: "Integration" };

export default async function IntegrationPage() {
  return <IntegrationView sdkFiles={await readSdkFiles()} />;
}
