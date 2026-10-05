"use client";

import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import { keys, useApp, useResolvedAccess, useWorkspace } from "@/lib/api/hooks";

type Variant = "plan" | "full";

const mask = (key: string) => `${key.slice(0, 8)}${"•".repeat(12)}${key.slice(-4)}`;

/** The raw resolved plan exactly as the SDK receives it, plus the request that fetches it. */
export function ApiResponseTab({ appId, accountId }: { appId: string; accountId: string }) {
  const [variant, setVariant] = useState<Variant>("plan");
  const [revealed, setRevealed] = useState(false);
  const { data: app } = useApp(appId);
  const { data: workspace } = useWorkspace();
  const publicPlan = useQuery({
    queryKey: [...keys.account(appId, accountId), "plan"],
    queryFn: () => api.accounts.plan(appId, accountId),
    enabled: variant === "plan",
    retry: false,
  });
  const fullPlan = useResolvedAccess(appId, accountId);
  const query = variant === "plan" ? publicPlan : fullPlan;

  const key = variant === "plan" ? app?.public_key : app?.api_key;
  const path = `/apps/${encodeURIComponent(appId)}/namespaces/${encodeURIComponent(accountId)}/${variant === "plan" ? "plan" : "full-plan"}`;
  const curlWith = (k: string) => `curl ${workspace?.apiBaseUrl ?? ""}${path} \\\n  -H "Authorization: Bearer ${k}"`;
  const curl = curlWith(key ? (revealed ? key : mask(key)) : "<key>");
  const status = query.error instanceof ApiError ? query.error.status : query.data ? 200 : null;
  const body = query.error
    ? JSON.stringify({ error: query.error.message }, null, 2)
    : query.data
      ? JSON.stringify(query.data, null, 2)
      : "";

  return (
    <div className="flex flex-col gap-5 px-8 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={variant}
          onValueChange={(v) => {
            setVariant(v);
            // Never carry a revealed public key over to the secret one.
            setRevealed(false);
          }}
          options={[
            { value: "plan", label: "Public · /plan" },
            { value: "full", label: "Secret · /full-plan" },
          ]}
        />
        <p className="text-sm text-fg-tertiary">
          Private meta keys are stripped from <code className="text-fg-secondary">/plan</code> and only appear in{" "}
          <code className="text-fg-secondary">/full-plan</code>.
        </p>
      </div>
      <CodeBlock
        lang="bash"
        code={curl}
        copyValue={key ? curlWith(key) : undefined}
        title={
          <span className="flex items-center gap-2">
            {variant === "plan" ? "Public key · safe in the browser" : "Secret key · server only"}
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="inline-flex h-5 items-center gap-1 rounded px-1 text-fg-tertiary outline-none hover:bg-bg-hover hover:text-fg focus-visible:shadow-[0_0_0_2px_var(--ring)] [&_svg]:size-3"
            >
              {revealed ? <EyeOff /> : <Eye />}
              {revealed ? "Hide key" : "Reveal key"}
            </button>
          </span>
        }
      />
      {query.isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <CodeBlock
          lang="json"
          code={body}
          maxHeight={520}
          title={
            <span className="flex items-center gap-2">
              Response
              {status ? <Badge color={status === 200 ? "green" : "red"}>{status === 200 ? "200 OK" : status}</Badge> : null}
            </span>
          }
        />
      )}
    </div>
  );
}
