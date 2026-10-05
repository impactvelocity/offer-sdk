"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

type Lang = "bash" | "ts" | "tsx" | "json" | "env" | "text";

const KEYWORDS =
  /\b(import|from|export|const|let|var|function|return|await|async|if|else|new|true|false|null|undefined|typeof|type|interface|default|curl)\b/;

const STRING = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/;

// Tiny tokenizer: strings, comments, numbers, keywords. Enough for readable snippets.
function highlight(code: string, lang: Lang): ReactNode[] {
  if (lang === "text") return [code];
  // Comments: `#` for shell, `//` for JS/TS (but not the `//` in URLs).
  const comment = lang === "bash" ? /(?:^|\s)#[^\n]*/ : /(?<!:)\/\/[^\n]*/;
  const pattern =
    lang === "env"
      ? /(#[^\n]*)|^([A-Z0-9_]+)(?==)/gm
      : new RegExp(`(${comment.source})|(${STRING.source})|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_]+)`, "gm");
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const [text, comment, str, num, word] = m;
    let cls = "";
    if (lang === "env") cls = comment ? "text-code-comment" : "text-code-keyword";
    else if (comment && (lang !== "json")) cls = "text-code-comment italic";
    else if (str) cls = lang === "json" && code[m.index + text.length] === ":" ? "text-code-key" : "text-code-string";
    else if (num) cls = "text-code-number";
    else if (word && KEYWORDS.test(word) && lang !== "json") cls = "text-code-keyword";
    else if (word && lang === "json" && /^(true|false|null)$/.test(word)) cls = "text-code-number";
    out.push(cls ? <span key={i++} className={cls}>{text}</span> : text);
    last = m.index + text.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function CodeBlock({
  code,
  copyValue,
  lang = "ts",
  title,
  className,
  maxHeight,
  wrap,
}: {
  code: string;
  /** What the copy button copies, when it differs from what's shown (e.g. a masked key). */
  copyValue?: string;
  /** Wrap long lines instead of scrolling horizontally (prose-like content). */
  wrap?: boolean;
  lang?: Lang;
  title?: ReactNode;
  className?: string;
  maxHeight?: number;
}) {
  return (
    <div className={cn("group/code relative overflow-hidden rounded-lg border border-border bg-bg-subtle", className)}>
      {title ? (
        <div className="flex h-10 items-center justify-between border-b border-border bg-bg px-3.5">
          <span className="text-xs font-medium text-fg-tertiary">{title}</span>
          <CopyButton value={copyValue ?? code} label="Copy code" />
        </div>
      ) : (
        <CopyButton
          value={copyValue ?? code}
          label="Copy code"
          className="absolute right-2 top-2 bg-bg-subtle opacity-0 group-hover/code:opacity-100 focus-visible:opacity-100"
        />
      )}
      <pre
        className={cn("overflow-auto px-4 py-3.5 text-[13.5px] leading-[1.7] text-fg scrollbar-thin", wrap && "whitespace-pre-wrap break-words")}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <code>{highlight(code, lang)}</code>
      </pre>
    </div>
  );
}

/** Code block with language/variant tabs (e.g. cURL / fetch / React). */
export function CodeTabs({
  tabs,
  className,
}: {
  tabs: { label: string; code: string; lang?: Lang; copyValue?: string }[];
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const tab = tabs[active] ?? tabs[0];
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-bg-subtle", className)}>
      <div className="flex h-10 items-center gap-1 border-b border-border bg-bg px-2">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "h-7 rounded-md px-2.5 text-xs font-medium outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--ring)]",
              i === active ? "bg-bg-muted text-fg" : "text-fg-tertiary hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto">
          <CopyButton value={tab.copyValue ?? tab.code} label="Copy code" />
        </span>
      </div>
      <pre className="overflow-auto px-4 py-3.5 text-[13.5px] leading-[1.7] text-fg scrollbar-thin">
        <code>{highlight(tab.code, tab.lang ?? "ts")}</code>
      </pre>
    </div>
  );
}
