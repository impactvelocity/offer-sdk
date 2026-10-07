"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Play, RotateCcw, Terminal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { useConfirm } from "@/components/ui/confirm";
import { useCopy } from "@/components/ui/copy-button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { keys } from "@/lib/api/hooks";
import { PATH_PARAMS, pathParams, type Endpoint } from "./endpoints";
import { fillExample, type DevContext } from "./use-dev-context";

type KeyKind = "secret" | "public";

interface Result {
  status: number;
  statusText: string;
  ms: number;
  body: string;
  isJson: boolean;
}

const UNSET = "__unset";

function initialValues(endpoint: Endpoint, ctx: DevContext) {
  const ex = ctx.examples;
  return {
    path: Object.fromEntries(
      pathParams(endpoint.path).map((p) => [p, ex[endpoint.examples?.[p] ?? PATH_PARAMS[p]?.example ?? "account"] ?? ""]),
    ),
    query: Object.fromEntries((endpoint.query ?? []).map((q) => [q.name, q.example ? fillExample(q.example, ex) : ""])),
    body: endpoint.exampleBody === undefined ? "" : JSON.stringify(fillExample(endpoint.exampleBody, ex), null, 2),
  };
}

function statusColor(status: number): BadgeColor {
  if (status >= 200 && status < 300) return "green";
  if (status >= 400 && status < 500) return "orange";
  return "red";
}

/** Sends the endpoint's request straight to the Offer API with this app's real key. */
export function TryIt({ endpoint, ctx }: { endpoint: Endpoint; ctx: DevContext }) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { copied, copy } = useCopy();
  const allowsPublic = endpoint.auth === "public-or-secret";
  const [keyKind, setKeyKind] = useState<KeyKind>(allowsPublic ? "public" : "secret");
  const [values, setValues] = useState(() => initialValues(endpoint, ctx));
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const key = (keyKind === "secret" ? ctx.app?.api_key : ctx.app?.public_key) ?? "";
  const hasBody = endpoint.body !== undefined;
  const path = endpoint.path.replace(/:(\w+)/g, (_, name: string) => encodeURIComponent(values.path[name] ?? ""));
  const qs = new URLSearchParams(Object.entries(values.query).filter(([, v]) => v !== "")).toString();
  const url = `${ctx.baseUrl}${path}${qs ? `?${qs}` : ""}`;
  const missing = pathParams(endpoint.path).filter((p) => !values.path[p]?.trim());

  const curl = [
    `curl${endpoint.method === "GET" ? "" : ` -X ${endpoint.method}`} "${url}"`,
    `  -H "Authorization: Bearer ${key}"`,
    ...(hasBody && values.body.trim()
      ? [`  -H "Content-Type: application/json"`, `  -d '${values.body.replace(/\s*\n\s*/g, " ").trim()}'`]
      : []),
  ].join(" \\\n");

  const send = async () => {
    let payload: string | undefined;
    if (hasBody && values.body.trim()) {
      try {
        payload = JSON.stringify(JSON.parse(values.body));
      } catch {
        setBodyError("Body isn't valid JSON.");
        return;
      }
    }
    if (endpoint.confirm) {
      const ok = await confirm({
        title: `Send ${endpoint.method} ${endpoint.path.replace(/^\/apps\/:appId/, "")}?`,
        description: endpoint.confirm,
        confirmLabel: "Send Request",
      });
      if (!ok) return;
    }
    setSending(true);
    const started = performance.now();
    try {
      const res = await fetch(url, {
        method: endpoint.method,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: payload,
      });
      const text = await res.text();
      let body = text;
      let isJson = false;
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
        isJson = true;
      } catch {}
      setResult({ status: res.status, statusText: res.statusText, ms: Math.round(performance.now() - started), body, isJson });
      // Keep the dashboard in sync with whatever the request changed (including regenerated keys).
      if (res.ok && endpoint.method !== "GET") await queryClient.invalidateQueries({ queryKey: keys.app(ctx.appId) });
    } catch (e) {
      setResult({
        status: 0,
        statusText: "Network error",
        ms: Math.round(performance.now() - started),
        body: e instanceof Error ? e.message : String(e),
        isJson: false,
      });
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setValues(initialValues(endpoint, ctx));
    setBodyError(null);
    setResult(null);
  };

  const setPath = (name: string, value: string) => setValues((v) => ({ ...v, path: { ...v.path, [name]: value } }));
  const setQuery = (name: string, value: string) => setValues((v) => ({ ...v, query: { ...v.query, [name]: value } }));

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-bg-subtle px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-fg">
          <Play className="size-3.5 text-fg-tertiary" />
          Try it
        </span>
        <div className={endpoint.noTryIt ? "hidden" : "ml-auto flex items-center gap-2"}>
          <span className="text-xs text-fg-tertiary">Authenticate with</span>
          <Select<KeyKind>
            size="sm"
            className="w-48"
            aria-label="API key"
            value={keyKind}
            onValueChange={setKeyKind}
            options={[
              { value: "secret", label: "Secret key", description: ctx.app ? `${ctx.app.api_key.slice(0, 10)}…` : undefined },
              {
                value: "public",
                label: "Public key",
                disabled: !allowsPublic,
                description: allowsPublic ? `${ctx.app?.public_key.slice(0, 10) ?? ""}…` : "Not accepted on this route",
              },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 p-3">
        {endpoint.noTryIt ? (
          <p className="text-sm text-fg-tertiary">{endpoint.noTryIt}</p>
        ) : (
          <>
            {pathParams(endpoint.path).length || endpoint.query?.length ? (
              <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
                {pathParams(endpoint.path).map((name) => (
                  <ParamRow key={name} name={name} hint="path" required>
                    <Input
                      size="sm"
                      value={values.path[name] ?? ""}
                      readOnly={name === "appId"}
                      onChange={(e) => setPath(name, e.target.value)}
                      className="font-mono text-[13.5px]"
                      aria-label={name}
                    />
                  </ParamRow>
                ))}
                {endpoint.query?.map((q) => (
                  <ParamRow key={q.name} name={q.name} hint="query" required={q.required}>
                    {q.options ? (
                      <Select
                        size="sm"
                        aria-label={q.name}
                        value={values.query[q.name] || UNSET}
                        onValueChange={(v) => setQuery(q.name, v === UNSET ? "" : v)}
                        options={[
                          ...(q.required ? [] : [{ value: UNSET, label: <span className="text-fg-tertiary">Not set</span> }]),
                          ...q.options.map((o) => ({ value: o, label: o })),
                        ]}
                      />
                    ) : (
                      <Input
                        size="sm"
                        value={values.query[q.name] ?? ""}
                        placeholder={q.default ? `Default: ${q.default}` : "Optional"}
                        onChange={(e) => setQuery(q.name, e.target.value)}
                        className="font-mono text-[13.5px]"
                        aria-label={q.name}
                      />
                    )}
                  </ParamRow>
                ))}
              </div>
            ) : null}

            {hasBody ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-fg-tertiary">Request body (JSON)</span>
                <Textarea
                  rows={Math.min(12, Math.max(3, values.body.split("\n").length))}
                  value={values.body}
                  spellCheck={false}
                  aria-label="Request body"
                  aria-invalid={Boolean(bodyError) || undefined}
                  data-invalid={bodyError ? "" : undefined}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, body: e.target.value }));
                    setBodyError(null);
                  }}
                  className="font-mono text-[13.5px] leading-[1.6]"
                />
                {bodyError ? <p className="text-xs text-danger-fg">{bodyError}</p> : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" loading={sending} disabled={!key || missing.length > 0} onClick={send}>
                {sending ? null : <Play />}
                Send request
              </Button>
              <Button variant="ghost" onClick={reset}>
                <RotateCcw />
                Reset
              </Button>
              <Button variant="ghost" onClick={() => copy(curl)}>
                {copied ? <Check /> : <Terminal />}
                {copied ? "Copied" : "Copy as cURL"}
              </Button>
              <p className="ml-auto text-xs text-fg-tertiary">
                Runs against live data with your real {keyKind} key
                {endpoint.method === "GET" ? "." : " and changes it."}
              </p>
            </div>
          </>
        )}
      </div>

      {result ? (
        <div className="border-t border-border">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <span className="text-xs font-medium text-fg-tertiary">Response</span>
            <Badge color={result.status ? statusColor(result.status) : "red"} dot>
              {result.status ? `${result.status} ${result.statusText}` : result.statusText}
            </Badge>
            <span className="text-xs tabular text-fg-tertiary">{result.ms} ms</span>
            <code className="ml-auto truncate text-[12.5px] text-fg-placeholder" title={url}>
              {endpoint.method} {url.replace(ctx.baseUrl, "")}
            </code>
          </div>
          <CodeBlock
            code={result.body || "(empty body)"}
            lang={result.isJson ? "json" : "text"}
            maxHeight={360}
            className="rounded-none border-x-0 border-b-0"
          />
        </div>
      ) : null}
    </div>
  );
}

function ParamRow({
  name,
  hint,
  required,
  children,
}: {
  name: string;
  hint: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <span className="flex min-w-0 flex-col">
        <code className="truncate text-[13.5px] leading-4 text-fg" title={name}>
          {name}
        </code>
        <span className="text-[12px] leading-4 text-fg-placeholder">
          {hint}
          {required ? " · required" : ""}
        </span>
      </span>
      {children}
    </>
  );
}
