"use client";

import { Braces, ChevronsDownUp, ChevronsUpDown, Code, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Callout } from "@/components/ui/callout";
import { EndpointRow } from "@/components/developers/endpoint-row";
import { endpointId, ENDPOINTS, GROUPS, type GroupId } from "@/components/developers/endpoints";
import { useActiveSection } from "@/components/developers/guide-layout";
import { useDevContext } from "@/components/developers/use-dev-context";
import { PageHeader, Toolbar } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { InputGroup } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, pluralize } from "@/lib/utils";

const COUNTS = Object.fromEntries(GROUPS.map((g) => [g.id, ENDPOINTS.filter((e) => e.group === g.id).length]));

export function ApiReferenceView() {
  const ctx = useDevContext();
  const ready = !ctx.isLoading && Boolean(ctx.app);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<"all" | GroupId>("all");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ENDPOINTS.filter(
      (e) =>
        (group === "all" || e.group === group) &&
        (!q || `${e.method} ${e.path}`.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q)),
    );
  }, [query, group]);

  const groups = useMemo(
    () => GROUPS.map((g) => ({ ...g, endpoints: filtered.filter((e) => e.group === g.id) })).filter((g) => g.endpoints.length),
    [filtered],
  );
  const groupIds = useMemo(() => groups.map((g) => `group-${g.id}`), [groups]);
  const active = useActiveSection(groupIds, ready);

  // #<endpoint id> (e.g. from the integration guide) opens that endpoint.
  useEffect(() => {
    if (!ready) return;
    const openFromHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!ENDPOINTS.some((e) => endpointId(e) === hash)) return;
      setExpanded((prev) => new Set(prev).add(hash));
      setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }));
    };
    const timer = setTimeout(openFromHash);
    window.addEventListener("hashchange", openFromHash);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, [ready]);

  const toggle = (id: string) => {
    const opening = !expanded.has(id);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (opening) next.add(id);
      else next.delete(id);
      return next;
    });
    if (opening) window.history.replaceState(null, "", `#${id}`);
  };

  const allOpen = filtered.length > 0 && filtered.every((e) => expanded.has(endpointId(e)));

  return (
    <>
      <PageHeader
        icon={<Braces />}
        title="API reference"
        badge={<Badge>{ENDPOINTS.length} endpoints</Badge>}
        actions={
          <>
            {ctx.baseUrl ? (
              <div className="hidden h-7 min-w-0 items-center gap-1.5 rounded-md border border-border bg-bg-subtle pl-2 pr-0.5 lg:flex">
                <span className="text-xs text-fg-tertiary">Base URL</span>
                <code className="max-w-72 truncate text-[12.5px] text-fg-secondary">{ctx.baseUrl}</code>
                {ctx.mode === "mock" ? <Badge color="orange">Mock</Badge> : null}
                <CopyButton value={ctx.baseUrl} label="Copy base URL" />
              </div>
            ) : null}
            <Link href={`/apps/${ctx.appId}/developers`} className={buttonVariants()}>
              <Code />
              Integration guide
            </Link>
          </>
        }
      />
      <Toolbar
        actions={
          <Button
            variant="ghost"
            disabled={!filtered.length}
            onClick={() => setExpanded(allOpen ? new Set() : new Set(filtered.map(endpointId)))}
          >
            {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
        }
      >
        <InputGroup
          size="sm"
          leading={<Search />}
          placeholder="Search paths and summaries"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          wrapperClassName="w-72"
        />
        <Select<"all" | GroupId>
          size="sm"
          className="w-44"
          aria-label="Group"
          value={group}
          onValueChange={setGroup}
          options={[
            { value: "all", label: "All groups" },
            ...GROUPS.map((g) => ({ value: g.id, label: `${g.title} (${COUNTS[g.id]})` })),
          ]}
        />
        {query || group !== "all" ? (
          <span className="text-sm text-fg-tertiary">{pluralize(filtered.length, "endpoint")}</span>
        ) : null}
      </Toolbar>

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Endpoint groups" className="hidden w-52 shrink-0 overflow-y-auto border-r border-border p-2 scrollbar-thin lg:block">
          {GROUPS.map((g) => {
            const count = groups.find((x) => x.id === g.id)?.endpoints.length ?? 0;
            return (
              <button
                key={g.id}
                type="button"
                disabled={!count}
                onClick={() => document.getElementById(`group-${g.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className={cn(
                  "flex h-7 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-bg-hover focus-visible:shadow-[0_0_0_2px_var(--ring)] disabled:pointer-events-none disabled:opacity-40",
                  active === `group-${g.id}` ? "bg-bg-hover font-medium text-fg" : "text-fg-secondary",
                )}
              >
                <span className="truncate">{g.title}</span>
                <span className="text-xs tabular text-fg-tertiary">{count}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 overflow-y-auto scrollbar-thin">
          {!ready ? (
            ctx.error ? (
              <div className="p-6">
                <Callout tone="danger" title="Couldn't load this app">
                  {ctx.error.message}
                </Callout>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-6">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-9" />
                ))}
              </div>
            )
          ) : !groups.length ? (
            <EmptyState
              compact
              icon={<SearchX />}
              title="No endpoints match"
              description="Try a path segment like “usage” or a method like “PATCH”."
              action={
                <Button
                  onClick={() => {
                    setQuery("");
                    setGroup("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              {groups.map((g) => (
                <section key={g.id} id={`group-${g.id}`} aria-labelledby={`group-${g.id}-title`}>
                  <div className="sticky top-0 z-10 flex min-h-10 items-baseline gap-3 border-b border-border bg-bg/95 px-5 py-2 backdrop-blur-sm">
                    <h2 id={`group-${g.id}-title`} className="shrink-0 text-sm font-semibold text-fg">
                      {g.title}
                    </h2>
                    <p className="hidden min-w-0 truncate text-xs text-fg-tertiary sm:block">{g.description.replace(/`/g, "")}</p>
                  </div>
                  {g.endpoints.map((e) => {
                    const id = endpointId(e);
                    return <EndpointRow key={id} endpoint={e} open={expanded.has(id)} onToggle={() => toggle(id)} ctx={ctx} />;
                  })}
                </section>
              ))}
              <p className="px-5 py-6 text-xs text-fg-tertiary">
                Every request needs <code>Authorization: Bearer &lt;key&gt;</code>. Errors return{" "}
                <code>{"{ \"error\": string }"}</code>.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
