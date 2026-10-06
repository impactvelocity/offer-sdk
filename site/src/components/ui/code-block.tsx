import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const KEYWORDS = /\b(import|from|export|const|let|function|return|await|async|new|true|false|null|default)\b/;
const STRING = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/;

// Tiny tokenizer (strings, object keys, comments, numbers, keywords), same colors as offer-app's CodeBlock.
export function highlight(code: string): ReactNode[] {
  const pattern = new RegExp(`((?<!:)\\/\\/[^\\n]*)|(${STRING.source})|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_]+)`, "gm");
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const [text, comment, str, num, word] = m;
    const cls = comment
      ? "text-code-comment italic"
      : str
        ? code[m.index + text.length] === ":"
          ? "text-code-key"
          : "text-code-string"
        : num
          ? "text-code-number"
          : word && KEYWORDS.test(word)
            ? "text-code-keyword"
            : "";
    out.push(cls ? <span key={i++} className={cls}>{text}</span> : text);
    last = m.index + text.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function CodeBlock({ code, title, className }: { code: string; title?: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-bg shadow-soft", className)}>
      {title ? (
        <div className="flex h-10 items-center gap-2 border-b border-border bg-panel px-4 text-xs text-fg-tertiary">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-bg-active" />
            <span className="size-2.5 rounded-full bg-bg-active" />
            <span className="size-2.5 rounded-full bg-bg-active" />
          </span>
          <span className="ml-2 font-mono">{title}</span>
        </div>
      ) : null}
      <pre className="overflow-x-auto p-5 text-[13px] leading-[22px] text-fg-secondary">
        <code>{highlight(code)}</code>
      </pre>
    </div>
  );
}
