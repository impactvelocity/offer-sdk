import Link from "next/link";
import { Children, isValidElement, type CSSProperties, type ReactNode } from "react";
import { highlight } from "@/components/ui/code-block";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

/*
 * Building blocks for docs pages (src/app/docs). Plain <p>, <ul>, <ol>, <a>, <code> and <strong>
 * inside the article are styled by `.docs-prose` in globals.css; these cover everything else.
 */

/** Plain text of a heading's children, for its anchor id and its "On this page" label. */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[`'’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Page title and the sentence under it. Every docs page starts with one. */
export function DocsHeader({ title, lead }: { title: ReactNode; lead?: ReactNode }) {
  return (
    <header>
      <h1 className="font-display text-3xl font-medium tracking-wide text-balance text-fg sm:text-4xl">{title}</h1>
      {lead ? <p className="mt-4 max-w-2xl text-lg/8 text-pretty text-fg-muted">{lead}</p> : null}
    </header>
  );
}

function Heading({ as: Tag, id, children, className }: { as: "h2" | "h3"; id?: string; children: ReactNode; className: string }) {
  const label = textOf(children);
  const anchor = id ?? slugify(label);
  return (
    <Tag id={anchor} data-toc-label={label} className={cn("group scroll-mt-24 text-fg", className)}>
      <a href={`#${anchor}`} className="focus-ring rounded-sm">
        {children}
        <span aria-hidden className="ml-2 text-fg-icon opacity-0 transition-opacity group-hover:opacity-100">
          #
        </span>
      </a>
    </Tag>
  );
}

export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <Heading as="h2" id={id} className="font-display text-2xl font-medium tracking-wide text-balance">
      {children}
    </Heading>
  );
}

export function H3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <Heading as="h3" id={id} className="text-lg font-medium">
      {children}
    </Heading>
  );
}

/** Light highlighting: the shared tokenizer for code, and `#` comment lines for shell. */
function highlightCode(code: string, lang: string) {
  if (lang !== "bash") return highlight(code);
  return code.split("\n").flatMap((line, i) => [
    i > 0 ? "\n" : null,
    line.trimStart().startsWith("#") ? (
      <span key={i} className="text-code-comment italic">
        {line}
      </span>
    ) : (
      line
    ),
  ]);
}

export function Code({ code, title, lang = "ts" }: { code: string; title?: string; lang?: "ts" | "tsx" | "bash" | "json" | "http" | "yaml" | "text" }) {
  const source = code.replace(/^\n+|\s+$/g, "");
  return (
    <div className="docs-block overflow-hidden rounded-xl border border-border bg-bg">
      {title ? (
        <div className="flex h-10 items-center justify-between gap-3 border-b border-border bg-panel pr-1.5 pl-4">
          <span className="truncate font-mono text-xs text-fg-tertiary">{title}</span>
          <CopyButton value={source} />
        </div>
      ) : null}
      <div className="relative">
        {title ? null : <CopyButton value={source} className="absolute top-2 right-2 bg-bg" />}
        <pre className={cn("overflow-x-auto p-4 text-[13px] leading-[22px] text-fg-secondary", !title && "pr-12")}>
          <code>{lang === "text" ? source : highlightCode(source, lang)}</code>
        </pre>
      </div>
    </div>
  );
}

/** A boxed aside. The title reads as the start of the sentence: "Shared key. The dashboard…" */
export function Callout({ title, tone = "note", children }: { title?: ReactNode; tone?: "note" | "warning"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "docs-block rounded-xl border px-5 py-4 text-[15px]/7 text-fg-tertiary [&_p+p]:mt-2",
        tone === "warning" ? "border-warning/30 bg-warning-subtle" : "border-border bg-panel",
      )}
    >
      {title ? <strong className={cn("font-medium", tone === "warning" ? "text-warning-fg" : "text-fg")}>{title} </strong> : null}
      {children}
    </div>
  );
}

/** Numbered procedure. Each step's title is an h3, so it shows in "On this page". */
export function Steps({ children }: { children: ReactNode }) {
  return <ol className="docs-block docs-steps">{children}</ol>;
}

export function Step({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <li className="docs-step">
      <H3 id={id}>{title}</H3>
      <div className="docs-step-body">{children}</div>
    </li>
  );
}

/** Hairline table. The first column is set in mono, since it's almost always a name or a key. */
export function Table({ head, rows, mono = true }: { head: string[]; rows: ReactNode[][]; mono?: boolean }) {
  return (
    <div className="docs-block overflow-x-auto rounded-xl border border-border">
      {/* Three or more columns scroll sideways on phones instead of squeezing into slivers. */}
      <table className={cn("w-full border-collapse text-left text-sm", head.length > 2 && "min-w-xl")}>
        <thead className="bg-panel text-fg">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="border-b border-border px-4 py-2.5 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-fg-tertiary">
          {rows.map((row, i) => (
            <tr key={i} className="align-top">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-4 py-3",
                    j === 0 && "text-fg",
                    j === 0 && mono && "font-mono text-[13px] whitespace-nowrap",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Term. What it means." rows on hairlines, the site's two-tone list. */
export function TermList({ items }: { items: { term: ReactNode; children: ReactNode }[] }) {
  return (
    <dl className="docs-block divide-y divide-border border-y border-border">
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)] gap-1 py-4 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:gap-6">
          <dt className="font-medium text-fg">{item.term}</dt>
          <dd className="text-fg-tertiary">{item.children}</dd>
        </div>
      ))}
    </dl>
  );
}

const methodColors: Record<string, BadgeColor> = {
  GET: "blue",
  POST: "brand",
  PUT: "orange",
  PATCH: "orange",
  DELETE: "red",
};

export function Method({ method }: { method: string }) {
  return (
    <Badge color={methodColors[method] ?? "gray"} className="w-16 justify-center font-mono text-[11px] tracking-wide">
      {method}
    </Badge>
  );
}

export type EndpointDoc = { method: string; path: string; summary: ReactNode; auth?: string };

/** Routes as hairline rows: method, path, what it does, and which credential it takes. */
export function EndpointList({ endpoints }: { endpoints: EndpointDoc[] }) {
  return (
    <ul className="docs-block divide-y divide-border overflow-hidden rounded-xl border border-border">
      {endpoints.map((e) => (
        <li key={`${e.method} ${e.path}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
          <div className="flex min-w-0 items-baseline gap-3 sm:w-[46%] sm:shrink-0">
            <Method method={e.method} />
            <code className="min-w-0 font-mono text-[13px] break-all text-fg">{e.path}</code>
          </div>
          <div className="min-w-0 flex-1 text-sm text-fg-tertiary">
            {e.summary}
            {e.auth ? <span className="mt-1 block text-xs text-fg-icon">{e.auth}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Directory listing with a note per entry, notes in one column. Indent with `depth`; notes drop under the path on phones. */
export function FileTree({ items }: { items: { path: string; depth?: number; note?: ReactNode }[] }) {
  return (
    <ul className="docs-block flex flex-col gap-2 rounded-xl border border-border bg-bg px-4 py-4 text-[13px] leading-5 sm:gap-1.5">
      {items.map((item, i) => (
        <li
          key={i}
          className="grid sm:grid-cols-[14rem_1fr] sm:gap-4"
          style={{ "--indent": `${(item.depth ?? 0) * 1.25}rem` } as CSSProperties}
        >
          <span className={cn("pl-(--indent) font-mono", item.path.endsWith("/") ? "text-fg" : "text-fg-secondary")}>
            {item.path}
          </span>
          {item.note ? <span className="pl-(--indent) text-fg-tertiary sm:pl-0">{item.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Links to other pages on a hairline grid: title over a short description, no icons. */
export function CardGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return (
    <div
      className={cn(
        "docs-block grid gap-px overflow-hidden rounded-xl border border-border bg-border",
        cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        // With two columns, an odd count would leave a hole in the last row: stretch the last card.
        cols === 2 && Children.count(children) % 2 === 1 && "sm:[&>*:last-child]:col-span-full",
      )}
    >
      {children}
    </div>
  );
}

export function Card({ href, title, children }: { href: string; title: ReactNode; children?: ReactNode }) {
  const external = /^https?:/.test(href);
  const className = "focus-ring group flex flex-col gap-1 bg-canvas px-5 py-4 transition-colors hover:bg-panel";
  const body = (
    <>
      <span className="font-medium text-fg">
        {title}
        <span aria-hidden className="ml-1.5 inline-block text-fg-icon transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
      {children ? <span className="text-sm text-fg-tertiary">{children}</span> : null}
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}
