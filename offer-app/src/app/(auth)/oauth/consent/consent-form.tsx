"use client";

import { ArrowLeftRight, Check, Plug } from "lucide-react";
import { useState } from "react";
import { ACCESS_LEVELS, levelAllows, MCP_TOOLS, type AccessLevel } from "@/components/developers/mcp-tools";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { ConsentApp, ConsentRequest } from "@/server/mcp-consent";

const RANK: Record<AccessLevel, number> = { read: 0, write: 1, full: 2 };

export function ConsentForm({
  request,
  apps,
  user,
  error,
}: {
  request: ConsentRequest;
  /** Apps to pick from, when the client didn't name one. */
  apps: ConsentApp[];
  user: { name: string; email: string };
  error: string | null;
}) {
  const serverLevel = request.server?.access_level ?? "write";
  const [level, setLevel] = useState<AccessLevel>(request.requested_level ?? serverLevel);
  const [appId, setAppId] = useState(apps[0]?.id ?? "");
  const [pending, setPending] = useState<"approve" | "deny" | null>(null);
  const appName = request.app_name ?? apps.find((a) => a.id === appId)?.name ?? "your app";
  const redirectHost = hostOf(request.redirect_uri);
  const count = (l: AccessLevel) => MCP_TOOLS.filter((t) => levelAllows(l, t.kind)).length;

  return (
    <div className="w-full max-w-[440px]">
      <form
        method="post"
        action="/oauth/consent/decide"
        onSubmit={(e) => {
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          setPending(submitter?.value === "deny" ? "deny" : "approve");
        }}
        className="rounded-xl border border-border bg-bg p-6 shadow-sm"
      >
        <input type="hidden" name="request" value={request.id} />
        <input type="hidden" name="access_level" value={level} />

        <div className="flex items-center gap-2 text-fg-icon">
          <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-bg-subtle text-base font-semibold text-fg">
            {request.client.name.slice(0, 1).toUpperCase()}
          </span>
          <ArrowLeftRight className="size-4" />
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-accent-contrast [&_svg]:size-5">
            <Plug />
          </span>
        </div>

        <h1 className="mt-4 font-display text-xl font-semibold text-fg">
          {request.client.name} wants to connect to {request.app_id ? appName : "Offer"}
        </h1>
        <p className="mt-1 text-sm text-fg-tertiary">
          It will use Offer&apos;s MCP tools as you ({user.email}), scoped to one app. You can disconnect it any time from
          Developers → MCP server.
        </p>

        {error ? (
          <p className="mt-4 rounded-md bg-danger-subtle px-2.5 py-2 text-sm text-danger-fg" role="alert">
            {error}
          </p>
        ) : null}

        {apps.length ? (
          <Field label="App" className="mt-5">
            <select
              name="app_id"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-bg px-2.5 text-sm text-fg shadow-xs outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]"
            >
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.workspace}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-fg">Access</legend>
          <div className="mt-2 flex flex-col gap-2" role="radiogroup">
            {ACCESS_LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                role="radio"
                aria-checked={level === l.value}
                onClick={() => setLevel(l.value)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--ring)]",
                  level === l.value ? "border-accent/40 bg-accent-subtle" : "border-border hover:bg-bg-subtle",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border [&_svg]:size-3",
                    level === l.value ? "border-accent bg-accent text-accent-contrast" : "border-border-strong",
                  )}
                >
                  {level === l.value ? <Check /> : null}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium text-fg">
                    {l.label}
                    <span className="text-xs font-normal text-fg-tertiary">{count(l.value)} tools</span>
                  </span>
                  <span className="block text-xs text-fg-tertiary">{l.description}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {request.server && RANK[level] > RANK[serverLevel] ? (
          <Callout tone="info" className="mt-4">
            This app&apos;s MCP server is set to {ACCESS_LEVELS.find((l) => l.value === serverLevel)?.label}. Tools it switches off
            stay off for every connection.
          </Callout>
        ) : null}

        <div className="mt-6 flex flex-col gap-2">
          <Button type="submit" name="decision" value="approve" variant="primary" size="md" className="w-full" loading={pending === "approve"} disabled={pending !== null}>
            Allow Access
          </Button>
          <Button type="submit" name="decision" value="deny" size="md" className="w-full" loading={pending === "deny"} disabled={pending !== null}>
            Cancel
          </Button>
        </div>
        <p className="mt-4 text-center text-xs text-fg-tertiary">You&apos;ll be sent back to {redirectHost}.</p>
      </form>
    </div>
  );
}

function hostOf(uri: string) {
  try {
    const url = new URL(uri);
    return url.host || `${url.protocol}//`;
  } catch {
    return uri;
  }
}
