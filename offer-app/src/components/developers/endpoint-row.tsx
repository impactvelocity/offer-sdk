"use client";

import { ChevronRight } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Callout } from "@/components/ui/callout";
import { AuthBadge, Md, MethodBadge, PathText } from "./bits";
import { endpointId, PATH_PARAMS, pathParams, type Endpoint } from "./endpoints";
import { TryIt } from "./try-it";
import { fillExample, type DevContext } from "./use-dev-context";

function codeColor(code: number): BadgeColor {
  if (code < 300) return "green";
  if (code < 500) return "orange";
  return "red";
}

export function EndpointRow({
  endpoint,
  open,
  onToggle,
  ctx,
}: {
  endpoint: Endpoint;
  open: boolean;
  onToggle: () => void;
  ctx: DevContext;
}) {
  const id = endpointId(endpoint);
  return (
    <div id={id} className="scroll-mt-12 border-b border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          "flex h-12 w-full items-center gap-3 px-5 text-left outline-none transition-colors hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]",
          open && "bg-bg-subtle",
        )}
      >
        <ChevronRight className={cn("size-3.5 shrink-0 text-fg-tertiary transition-transform", open && "rotate-90")} />
        <MethodBadge method={endpoint.method} />
        <PathText path={endpoint.path} dimPrefix className="min-w-0 truncate" />
        <span className="hidden min-w-0 flex-1 truncate text-sm text-fg-tertiary sm:block">{endpoint.summary}</span>
        <span className="hidden shrink-0 items-center gap-1.5 md:flex">
          {endpoint.proposed ? <Badge color="purple">Proposed</Badge> : null}
          <AuthBadge auth={endpoint.auth} />
        </span>
      </button>
      {open ? <EndpointDetails endpoint={endpoint} ctx={ctx} /> : null}
    </div>
  );
}

function EndpointDetails({ endpoint, ctx }: { endpoint: Endpoint; ctx: DevContext }) {
  const example = useMemo(
    () => (endpoint.response.example === undefined ? null : JSON.stringify(fillExample(endpoint.response.example, ctx.examples), null, 2)),
    [endpoint.response.example, ctx.examples],
  );
  const params = pathParams(endpoint.path);

  return (
    <div className="flex flex-col gap-5 px-5 pb-6 pt-2 sm:pl-[52px]">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5 md:hidden">
          {endpoint.proposed ? <Badge color="purple">Proposed</Badge> : null}
          <AuthBadge auth={endpoint.auth} />
        </div>
        {endpoint.description ? (
          <p className="text-sm text-fg-secondary">
            <Md>{endpoint.description}</Md>
          </p>
        ) : null}
        {endpoint.proposed ? (
          <Callout title="Proposed endpoint">
            Served by the mock API so the dashboard can use it; not in the hosted API yet. Expect a 404 there.
          </Callout>
        ) : null}
        {endpoint.warning ? (
          <Callout tone="warning">
            <Md>{endpoint.warning}</Md>
          </Callout>
        ) : null}
      </div>

      {params.length || endpoint.query?.length ? (
        <DocTable title="Parameters" head={["Name", "In", "Type", "Description"]}>
          {params.map((name) => (
            <tr key={name}>
              <NameCell name={name} required />
              <TD className="text-fg-tertiary">path</TD>
              <TD className="font-mono text-xs text-fg-secondary">string</TD>
              <TD className="text-fg-secondary">{PATH_PARAMS[name]?.description ?? ""}</TD>
            </tr>
          ))}
          {endpoint.query?.map((q) => (
            <tr key={q.name}>
              <NameCell name={q.name} required={q.required} />
              <TD className="text-fg-tertiary">query</TD>
              <TD className="font-mono text-xs text-fg-secondary">{q.options ? q.options.join(" | ") : q.type}</TD>
              <TD className="text-fg-secondary">
                <Md>{q.description}</Md>
                {q.default ? <span className="text-fg-tertiary"> Default: {q.default}.</span> : null}
              </TD>
            </tr>
          ))}
        </DocTable>
      ) : null}

      {endpoint.body?.length ? (
        <DocTable title="Request body" head={["Field", "Type", "Description"]}>
          {endpoint.body.map((f) => (
            <tr key={f.name}>
              <NameCell name={f.name} required={f.required} />
              <TD className="font-mono text-xs text-fg-secondary">{f.type}</TD>
              <TD className="text-fg-secondary">
                <Md>{f.description}</Md>
              </TD>
            </tr>
          ))}
        </DocTable>
      ) : null}

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-fg">Response</h4>
        <p className="text-sm text-fg-secondary">
          <Md>{endpoint.response.description}</Md>
        </p>
        <div className="flex flex-col gap-1">
          {endpoint.statuses.map((s) => (
            <div key={s.code} className="flex items-baseline gap-2 text-sm">
              <Badge color={codeColor(s.code)} className="w-10 justify-center font-mono">
                {s.code}
              </Badge>
              <span className="text-fg-secondary">
                <Md>{s.description}</Md>
              </span>
            </div>
          ))}
        </div>
        {example ? <CodeBlock code={example} lang="json" title="Example response" maxHeight={300} /> : null}
      </div>

      <TryIt endpoint={endpoint} ctx={ctx} />
    </div>
  );
}

function DocTable({ title, head, children }: { title: string; head: string[]; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-fg">{title}</h4>
      <div className="overflow-x-auto rounded-lg border border-border scrollbar-thin [&_tbody_tr:last-child>td]:border-b-0 [&_td]:h-auto [&_td]:py-2 [&_td]:align-top">
        <Table>
          <THead className="static bg-bg-subtle">
            <tr>
              {head.map((h, i) => (
                <TH key={h} className={cn("h-8 text-xs", i === head.length - 1 && "w-full")}>
                  {h}
                </TH>
              ))}
            </tr>
          </THead>
          <TBody>{children}</TBody>
        </Table>
      </div>
    </div>
  );
}

function NameCell({ name, required }: { name: string; required?: boolean }) {
  return (
    <TD className="whitespace-nowrap">
      <code className="text-[13.5px] text-fg">{name}</code>
      {required ? <span className="ml-1.5 text-[12px] text-danger-fg">required</span> : null}
    </TD>
  );
}
