"use client";

import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { keys, useApiMutation } from "@/lib/api/hooks";
import type { WebhookDelivery, WebhookEndpoint } from "@/lib/api/types";
import { endpointName, eventTitle } from "./bits";

export function testResultToast(delivery: WebhookDelivery) {
  if (delivery.status === "succeeded") {
    toast.success(`Test ${eventTitle(delivery.event_type)} delivered (HTTP ${delivery.response_status})`);
  } else {
    toast.error(`Test failed: ${delivery.response_status ? `HTTP ${delivery.response_status}` : (delivery.error ?? "no response")}`);
  }
}

/** Sends a sample event to an endpoint and toasts the outcome. */
export function useSendTest(appId: string) {
  return useApiMutation(
    ({ endpoint, type }: { endpoint: WebhookEndpoint; type?: string }) => api.webhooks.test(appId, endpoint.id, type),
    { invalidate: [keys.webhooks(appId)], onSuccess: testResultToast },
  );
}

export function useToggleEndpoint(appId: string) {
  return useApiMutation(
    (endpoint: WebhookEndpoint) => api.webhooks.update(appId, endpoint.id, { enabled: !endpoint.enabled }),
    { success: (e) => (e.enabled ? "Endpoint resumed" : "Endpoint paused"), invalidate: [keys.webhooks(appId)] },
  );
}

export function useDeleteEndpoint(appId: string, { onDeleted }: { onDeleted?: () => void } = {}) {
  const confirm = useConfirm();
  const remove = useApiMutation((endpoint: WebhookEndpoint) => api.webhooks.delete(appId, endpoint.id), {
    success: "Endpoint deleted",
    invalidate: [keys.webhooks(appId)],
    onSuccess: onDeleted,
  });
  return (endpoint: WebhookEndpoint) =>
    confirm({
      title: `Delete ${endpointName(endpoint)}?`,
      description:
        endpoint.source === "zapier"
          ? "Your Zap stops receiving events right away, and the delivery log is deleted. The Zap itself stays in Zapier."
          : "It stops receiving events right away, pending retries are dropped and the delivery log is deleted.",
      confirmLabel: "Delete endpoint",
      onConfirm: () => remove.mutateAsync(endpoint),
    });
}
