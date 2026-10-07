"use client";

import { Tabs } from "@base-ui/react/tabs";
import {
  AlertTriangle,
  CalendarClock,
  Hourglass,
  LogOut,
  Package,
  RotateCcw,
  Sparkles,
  Tag,
  UserPlus,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { highlight } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";
import { Control, Panel, Segmented, SwitchRow } from "./controls";
import { ControlsDrawer } from "./controls-drawer";
import { MockApp } from "./mock-app";
import {
  entitlements,
  featureLabels,
  fullPlan,
  initialState,
  planOrder,
  plans,
  reducer,
  type Action,
  type BoolFeature,
  type LogEvent,
} from "./state";

const CHECKOUT_MS = 1100;

/** Control panel, the mock app, and what the SDK saw, all driven by one reducer. */
export function DemoPlayground() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const start = useRef<number | null>(null);

  const act = useCallback((action: Action) => {
    const now = performance.now();
    start.current ??= now;
    dispatch({ ...action, t: now - start.current });
  }, []);

  // PayPal "processes" the order for a beat before the webhooks land.
  useEffect(() => {
    if (!state.pending) return;
    const id = setTimeout(() => act({ type: "checkout_complete" }), CHECKOUT_MS);
    return () => clearTimeout(id);
  }, [state.pending, act]);

  const e = entitlements(state);
  const paid = state.plan !== "free";

  return (
    <div className="grid gap-6 lg:grid-cols-[288px_minmax(0,1fr)]">
      <ControlsDrawer
        title="Demo settings"
        summary={`${plans[state.plan].name} plan · ${e.ai_credits.used.toLocaleString()} / ${e.ai_credits.limit.toLocaleString()} credits`}
        className="lg:sticky lg:top-20 lg:self-start"
      >
        <Panel title="Plan">
          <Segmented
            label="Plan"
            value={state.plan}
            options={planOrder.map((id) => ({ value: id, label: plans[id].name }))}
            onChange={(plan) => act({ type: "set_plan", plan })}
          />
        </Panel>

        <Panel title="Usage">
          <Control icon={<Zap />} onClick={() => act({ type: "use_credits", amount: 250 })}>
            Use 250 AI credits
          </Control>
          <Control icon={<Sparkles />} onClick={() => act({ type: "max_credits" })} disabled={e.ai_credits.used >= e.ai_credits.limit}>
            Max out credits
          </Control>
          <Control icon={<UserPlus />} onClick={() => act({ type: "invite" })}>
            Invite a teammate
          </Control>
          <Control icon={<CalendarClock />} onClick={() => act({ type: "reset_usage" })}>
            Start a new billing period
          </Control>
        </Panel>

        <Panel title="Lifecycle">
          <Control icon={<Hourglass />} onClick={() => act({ type: "start_trial", days: 14 })} disabled={state.status === "trialing"}>
            Start a 14-day Pro trial
          </Control>
          <Control icon={<Hourglass />} onClick={() => act({ type: "start_trial", days: 2 })} disabled={state.status !== "trialing" || state.trialDaysLeft === 2}>
            Skip to trial&apos;s last 2 days
          </Control>
          <Control icon={<AlertTriangle />} onClick={() => act({ type: "payment_failed" })} disabled={!paid || state.status === "past_due"}>
            Payment fails
          </Control>
          <Control icon={<LogOut />} onClick={() => act({ type: "cancel_clicked" })} disabled={!paid || state.status === "canceled"}>
            Customer clicks cancel
          </Control>
        </Panel>

        <Panel title="Offers & incentives">
          <Control icon={<Tag />} onClick={() => act({ type: "apply_promo" })} disabled={state.incentive?.code === "SPRING20"}>
            Apply promo SPRING20
          </Control>
          <Control icon={<Package />} onClick={() => act({ type: "grant_pack" })}>
            Grant +2,000 credit add-on
          </Control>
        </Panel>

        <Panel title="Entitlement overrides">
          {(Object.keys(featureLabels) as BoolFeature[]).map((f) => (
            <SwitchRow
              key={f}
              label={featureLabels[f]}
              checked={e[f]}
              onChange={(value) => act({ type: "set_override", feature: f, value })}
              note={state.overrides[f] != null ? <span className="text-2xs text-warning-fg">override</span> : null}
            />
          ))}
        </Panel>

        <button
          type="button"
          onClick={() => act({ type: "reset" })}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm text-fg-muted hover:bg-bg-hover hover:text-fg"
        >
          <RotateCcw className="size-4" />
          Reset demo
        </button>
      </ControlsDrawer>

      <div className="min-w-0 space-y-4">
        <MockApp state={state} act={act} />
        <Inspector state={state} />
      </div>
    </div>
  );
}

function Inspector({ state }: { state: typeof initialState }) {
  return (
    <Tabs.Root defaultValue="log" className="overflow-hidden rounded-xl border border-border bg-panel">
      <Tabs.List className="flex h-10 items-center gap-1 border-b border-border px-2">
        {[
          { value: "log", label: "Event log" },
          { value: "plan", label: "full-plan" },
        ].map((t) => (
          <Tabs.Tab
            key={t.value}
            value={t.value}
            className="h-7 rounded-md px-2.5 font-mono text-xs text-fg-muted outline-none transition-colors hover:text-fg focus-visible:bg-bg-hover data-active:bg-bg-active data-active:text-fg"
          >
            {t.label}
          </Tabs.Tab>
        ))}
        <span className="ml-auto flex items-center gap-1.5 pr-2 text-2xs text-fg-muted">
          <span className="size-1.5 animate-pulse rounded-full bg-success" />
          live
        </span>
      </Tabs.List>
      <Tabs.Panel value="log" className="h-64 overflow-y-auto py-1 outline-none">
        <ol>
          {state.events.map((ev) => (
            <LogRow key={ev.id} event={ev} />
          ))}
        </ol>
      </Tabs.Panel>
      <Tabs.Panel value="plan" className="h-64 overflow-auto outline-none">
        <pre className="p-4 text-[12px] leading-5 text-fg-secondary">
          <code>{highlight(JSON.stringify(fullPlan(state), null, 2))}</code>
        </pre>
      </Tabs.Panel>
    </Tabs.Root>
  );
}

const tagStyle: Record<LogEvent["tag"], string> = {
  GET: "bg-tag-green-bg text-tag-green-fg",
  POST: "bg-tag-blue-bg text-tag-blue-fg",
  SDK: "bg-tag-gray-bg text-tag-gray-fg",
  HOOK: "bg-tag-brand-bg text-tag-brand-fg",
};

const toneStyle: Record<NonNullable<LogEvent["tone"]>, string> = {
  ok: "text-success-fg",
  warn: "text-warning-fg",
  err: "text-danger-fg",
  info: "text-fg-tertiary",
};

function LogRow({ event }: { event: LogEvent }) {
  const secs = (event.t / 1000).toFixed(1);
  return (
    <li className="feature-in flex items-center gap-3 px-4 py-1 font-mono text-[11.5px] leading-5">
      <span className="w-10 shrink-0 text-right text-fg-placeholder tabular">{secs}s</span>
      <span className={cn("w-11 shrink-0 rounded px-1 text-center text-[10px] font-medium", tagStyle[event.tag])}>{event.tag}</span>
      <span className="min-w-0 flex-1 truncate text-fg-secondary">{event.text}</span>
      {event.status ? <span className={cn("max-w-[45%] truncate text-right", toneStyle[event.tone ?? "info"])}>{event.status}</span> : null}
    </li>
  );
}
