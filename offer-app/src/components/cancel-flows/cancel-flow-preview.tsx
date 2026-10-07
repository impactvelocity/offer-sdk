"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import type { CancelFlowStep, CancelOfferPreview } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { CancelFlow, CancelFlowProvider, useCancelFlow } from "@/sdk/cancel";
import styles from "./cancel-flow.module.css";
import { previewTransport } from "./preview-transport";

export interface PreviewInput {
  appId: string;
  flowId: string;
  name: string;
  steps: CancelFlowStep[];
  /** Jump straight to this step. */
  startAt?: string | null;
  /** Answers assumed when jumping past the questions. */
  answers?: string[];
  /** A real account to price the offer for; a sample one otherwise. */
  account?: string | null;
  /** Ask Claude for the offer (when the offer step has it on). */
  useClaude?: boolean;
}

/**
 * The cancel flow as a customer sees it, rendered with the real SDK
 * components on the editor's unsaved steps. Offers come from the API so
 * prices and copy are exact; nothing is saved or charged.
 */
export function CancelFlowPreview({
  className,
  onOffer,
  ...input
}: PreviewInput & { className?: string; onOffer?(result: CancelOfferPreview | null, error?: string): void }) {
  const [restarts, setRestarts] = useState(0);
  const { appId, flowId, name, steps, startAt, answers, account, useClaude } = input;
  const key = JSON.stringify([steps, startAt, answers, account, useClaude, restarts]);

  const transport = useMemo(
    () =>
      previewTransport({
        name,
        steps,
        startAt,
        answers,
        offerFor: async (ids, texts) => {
          try {
            const result = await api.cancelFlows.previewOffer(appId, flowId, {
              steps,
              answers: ids,
              texts,
              account: account || null,
              dynamic: !!useClaude,
            });
            onOffer?.(result);
            return result.offer;
          } catch (err) {
            onOffer?.(null, err instanceof Error ? err.message : String(err));
            return null;
          }
        },
      }),
    // A new transport (and session) whenever the inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return (
    <div className={cn("rounded-xl border border-border bg-bg p-5 shadow-sm", className)}>
      <CancelFlowProvider key={key} transport={transport} paypal="manual" onClose={() => setRestarts((n) => n + 1)}>
        <AutoStart />
        <CancelFlow.Steps className={styles.flow} />
      </CancelFlowProvider>
    </div>
  );
}

function AutoStart() {
  const { open } = useCancelFlow();
  useEffect(() => {
    void open();
  }, [open]);
  return null;
}
