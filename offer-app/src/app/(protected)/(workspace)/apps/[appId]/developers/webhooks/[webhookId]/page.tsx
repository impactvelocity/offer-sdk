import type { Metadata } from "next";
import { WebhookDetail } from "./webhook-detail";

export const metadata: Metadata = { title: "Webhook endpoint" };

export default async function WebhookPage({ params }: PageProps<"/apps/[appId]/developers/webhooks/[webhookId]">) {
  const { webhookId } = await params;
  return <WebhookDetail webhookId={decodeURIComponent(webhookId)} />;
}
