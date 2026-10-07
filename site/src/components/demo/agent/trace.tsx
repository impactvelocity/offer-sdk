"use client";

import { Bot, Brain, Check, Wrench } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LogTag, LogTone } from "../state";

/*
 * The agent's side of the agentic demos. Nothing calls a model: each scenario scripts the steps
 * a real run would take, and `useTrace` plays them back on a timer so the app and the trace
 * update together.
 */

export type TraceStep =
  | { kind: "tool"; name: string; args?: string; result: string }
  | { kind: "think"; text: string }
  | { kind: "event"; tag: LogTag; text: string; status?: string; tone?: LogTone }
  | { kind: "done"; text: string };

type Shown = TraceStep & { id: number };

const delays: Record<TraceStep["kind"], number> = { tool: 160, think: 240, event: 70, done: 100 };

export function useTrace() {
  const [steps, setSteps] = useState<Shown[]>([]);
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seq = useRef(0);

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRunning(false);
  }, []);

  const push = useCallback((...next: TraceStep[]) => {
    const shown = next.map((s) => ({ ...s, id: seq.current++ }));
    setSteps((prev) => [...prev, ...shown].slice(-60));
  }, []);

  /** Plays steps one at a time, then calls `onDone`. Cancels anything still playing. */
  const play = useCallback(
    (next: TraceStep[], onDone?: () => void, { reset = false } = {}) => {
      stop();
      if (reset) setSteps([]);
      if (!next.length) return onDone?.();
      setRunning(true);
      let t = 0;
      next.forEach((step, i) => {
        t += delays[step.kind];
        timers.current.push(
          setTimeout(() => {
            push(step);
            if (i === next.length - 1) {
              setRunning(false);
              onDone?.();
            }
          }, t),
        );
      });
    },
    [push, stop],
  );

  const clear = useCallback(() => {
    stop();
    setSteps([]);
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { steps, running, play, push, clear };
}

const tagStyle: Record<LogTag, string> = {
  GET: "bg-tag-green-bg text-tag-green-fg",
  POST: "bg-tag-blue-bg text-tag-blue-fg",
  SDK: "bg-tag-gray-bg text-tag-gray-fg",
  HOOK: "bg-tag-brand-bg text-tag-brand-fg",
};

const toneStyle: Record<LogTone, string> = {
  ok: "text-success-fg",
  warn: "text-warning-fg",
  err: "text-danger-fg",
  info: "text-fg-tertiary",
};

export function TracePanel({
  steps,
  running,
  idle,
  className,
}: {
  steps: Shown[];
  running: boolean;
  /** Shown before the first step. */
  idle: ReactNode;
  className?: string;
}) {
  const body = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = body.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
  }, [steps.length, running]);

  return (
    <section className={cn("flex flex-col overflow-hidden rounded-xl border border-border bg-panel", className)}>
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="inline-flex size-6 items-center justify-center rounded-md bg-brand-soft text-accent-fg">
          <Bot className="size-3.5" />
        </span>
        <span className="text-sm font-medium">Agent trace</span>
        <span className="ml-auto flex items-center gap-1.5 text-2xs text-fg-muted">
          <span className={cn("size-1.5 rounded-full", running ? "animate-pulse bg-accent" : "bg-success")} />
          {running ? "thinking" : "idle"}
        </span>
      </header>
      <ol ref={body} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
        {steps.length === 0 && !running ? <li className="px-1 py-2 text-xs text-fg-muted">{idle}</li> : null}
        {steps.map((s) => (
          <li key={s.id} className="feature-in">
            <Step step={s} />
          </li>
        ))}
        {running ? (
          <li className="flex items-center gap-1 px-1 py-1" aria-label="Working">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1 animate-pulse rounded-full bg-fg-icon" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </li>
        ) : null}
      </ol>
    </section>
  );
}

function Step({ step }: { step: TraceStep }) {
  switch (step.kind) {
    case "tool":
      return (
        <div className="rounded-lg border border-border bg-bg px-2.5 py-2">
          <p className="flex items-center gap-1.5 font-mono text-[11.5px] text-fg">
            <Wrench className="size-3 shrink-0 text-fg-icon" />
            <span className="truncate">
              {step.name}
              <span className="text-fg-muted">({step.args ?? ""})</span>
            </span>
          </p>
          <p className="mt-1 pl-[18px] font-mono text-[11px] leading-4 text-fg-tertiary">→ {step.result}</p>
        </div>
      );
    case "think":
      return (
        <p className="flex gap-2 px-1 text-xs leading-5 text-fg-secondary">
          <Brain className="mt-0.5 size-3.5 shrink-0 text-accent-fg" />
          <span>{step.text}</span>
        </p>
      );
    case "event":
      return (
        <p className="flex items-center gap-2 px-1 font-mono text-[11px]">
          <span className={cn("w-10 shrink-0 rounded px-1 text-center text-[10px] font-medium", tagStyle[step.tag])}>{step.tag}</span>
          <span className="min-w-0 flex-1 truncate text-fg-secondary">{step.text}</span>
          {step.status ? <span className={cn("max-w-[45%] truncate text-right", toneStyle[step.tone ?? "info"])}>{step.status}</span> : null}
        </p>
      );
    case "done":
      return (
        <p className="flex items-center gap-2 rounded-lg bg-success-subtle px-2.5 py-1.5 text-xs text-success-fg">
          <Check className="size-3.5 shrink-0" strokeWidth={3} />
          {step.text}
        </p>
      );
  }
}

/** Reveals text a few characters at a time, like a model streaming it. */
export function Typewriter({ text, speed = 12 }: { text: string; speed?: number }) {
  // Progress is tied to the text it was made for, so new text starts from zero without a reset.
  const [progress, setProgress] = useState({ text, n: 0 });
  const shown = progress.text === text ? progress.n : 0;

  useEffect(() => {
    const step = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? text.length : 4;
    const id = setInterval(() => {
      setProgress((p) => {
        const n = (p.text === text ? p.n : 0) + step;
        if (n >= text.length) clearInterval(id);
        return { text, n };
      });
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return (
    <span>
      {text.slice(0, shown)}
      {shown < text.length ? <span className="ml-px inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-accent" /> : null}
    </span>
  );
}
