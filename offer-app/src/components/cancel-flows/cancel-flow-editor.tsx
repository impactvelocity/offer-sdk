"use client";

import { ArrowDown, ArrowUp, CircleAlert, DoorOpen, MessageSquareText, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PageBody, PageHeader } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Section } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import { keys, useApiMutation, useIncentives, usePlans } from "@/lib/api/hooks";
import type {
  CancelFlow,
  CancelFlowAnswer,
  CancelFlowStep,
  CancelOfferPreview,
  Incentive,
  Plan,
  SaveOfferGuardrails,
  SaveOfferKind,
  SaveOfferSpec,
} from "@/lib/api/types";
import { cn, slugify } from "@/lib/utils";
import { CancelFlowPreview } from "./cancel-flow-preview";
import { KIND_DESCRIPTIONS, KIND_LABELS } from "./format";

type QuestionStep = Extract<CancelFlowStep, { type: "question" }>;
type TextStep = Extract<CancelFlowStep, { type: "text" }>;
type OfferStep = Extract<CancelFlowStep, { type: "offer" }>;
type ConfirmStep = Extract<CancelFlowStep, { type: "confirm" }>;

const KINDS: SaveOfferKind[] = ["discount", "pause", "downgrade", "incentive"];

const DEFAULT_GUARDRAILS: SaveOfferGuardrails = {
  kinds: [...KINDS],
  max_discount_percent: 50,
  max_discount_cycles: 3,
  max_pause_months: 3,
  max_incentive_months: 3,
  incentives: [],
  downgrade_plans: [],
  instructions: "",
};

const newOfferStep = (): OfferStep => ({
  id: "save",
  type: "offer",
  title: "Before you go",
  dynamic: false,
  guardrails: { ...DEFAULT_GUARDRAILS },
  default: null,
  by_answer: {},
  decline_label: "No thanks, continue cancelling",
});

const uniqueId = (base: string, taken: Set<string>) => {
  const root = slugify(base).replace(/[^a-z0-9_-]/g, "").slice(0, 32) || "item";
  let id = root;
  for (let n = 2; taken.has(id); n++) id = `${root}_${n}`;
  return id;
};

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Edits a cancel flow: the questions, the save offer (fixed per answer, or
 * picked by Claude within guardrails) and the final confirmation. The right
 * column is the real SDK flow running on the unsaved steps.
 */
export function CancelFlowEditor({ appId, flow }: { appId: string; flow: CancelFlow }) {
  const router = useRouter();
  const plans = usePlans(appId);
  const incentives = useIncentives(appId);
  const [name, setName] = useState(flow.name);
  const [steps, setSteps] = useState<CancelFlowStep[]>(flow.steps);
  // Answers added in this session get ids from their label; saved ones keep theirs (stats use them).
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const questions = steps.filter((s): s is QuestionStep | TextStep => s.type === "question" || s.type === "text");
  const offer = steps.find((s): s is OfferStep => s.type === "offer") ?? null;
  const confirm = steps.find((s): s is ConfirmStep => s.type === "confirm")!;
  const allAnswers = questions.flatMap((q) => (q.type === "question" ? q.answers.map((a) => ({ ...a, question: q.title })) : []));
  const capabilities = flow.capabilities;

  const update = (id: string, fn: (s: CancelFlowStep) => CancelFlowStep) => setSteps((all) => all.map((s) => (s.id === id ? fn(s) : s)));
  const updateOffer = (fn: (s: OfferStep) => OfferStep) => offer && update(offer.id, (s) => fn(s as OfferStep));

  const takenIds = () => new Set(steps.flatMap((s) => [s.id, ...(s.type === "question" ? s.answers.map((a) => a.id) : [])]));

  const addStep = (type: "question" | "text") => {
    const id = uniqueId(type === "question" ? "question" : "details", takenIds());
    const step: CancelFlowStep =
      type === "question"
        ? {
            id,
            type,
            title: "",
            answers: [
              { id: uniqueId(`${id}_a`, takenIds()), label: "" },
              { id: uniqueId(`${id}_b`, takenIds()), label: "" },
            ],
          }
        : { id, type, title: "", placeholder: "", required: false };
    if (step.type === "question") setFresh((f) => new Set([...f, ...step.answers.map((a) => a.id)]));
    // New questions go before the offer (or the confirmation).
    setSteps((all) => {
      const at = all.findIndex((s) => s.type === "offer" || s.type === "confirm");
      return [...all.slice(0, at), step, ...all.slice(at)];
    });
  };

  const moveStep = (id: string, dir: -1 | 1) =>
    setSteps((all) => {
      const i = all.findIndex((s) => s.id === id);
      const j = i + dir;
      const target = all[j];
      if (!target || target.type === "offer" || target.type === "confirm") return all;
      const next = [...all];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const removeStep = (id: string) => setSteps((all) => all.filter((s) => s.id !== id));

  const setAnswers = (stepId: string, fn: (answers: CancelFlowAnswer[]) => CancelFlowAnswer[]) =>
    update(stepId, (s) => (s.type === "question" ? { ...s, answers: fn(s.answers) } : s));

  // Fresh answers follow their label; by_answer keys follow the id.
  const setAnswerLabel = (stepId: string, answerId: string, label: string) => {
    let nextId = answerId;
    if (fresh.has(answerId) && label.trim()) {
      const taken = takenIds();
      taken.delete(answerId);
      nextId = uniqueId(label, taken);
    }
    setSteps((all) =>
      all.map((s) => {
        if (s.id === stepId && s.type === "question") {
          return { ...s, answers: s.answers.map((a) => (a.id === answerId ? { ...a, id: nextId, label } : a)) };
        }
        if (s.type === "offer" && nextId !== answerId && answerId in s.by_answer) {
          const { [answerId]: spec, ...rest } = s.by_answer;
          return { ...s, by_answer: { ...rest, [nextId]: spec } };
        }
        return s;
      }),
    );
    if (nextId !== answerId) setFresh((f) => new Set([...[...f].filter((x) => x !== answerId), nextId]));
  };

  const toggleOffer = (on: boolean) =>
    setSteps((all) => {
      if (!on) return all.filter((s) => s.type !== "offer");
      const at = all.findIndex((s) => s.type === "confirm");
      return [...all.slice(0, at), newOfferStep(), ...all.slice(at)];
    });

  // Answers that skip the offer point straight at the confirmation.
  const skipsOffer = (a: CancelFlowAnswer) => !!a.next && a.next === confirm.id;

  const problems = useMemo(() => {
    const out: string[] = [];
    if (!name.trim()) out.push("Give the flow a name.");
    for (const q of questions) {
      if (!q.title.trim()) out.push("Every question needs a title.");
      if (q.type === "question" && q.answers.some((a) => !a.label.trim())) out.push(`“${q.title || "Untitled"}” has an empty answer.`);
      if (q.type === "question" && q.answers.length < 2) out.push(`“${q.title || "Untitled"}” needs at least two answers.`);
    }
    if (!confirm.title.trim()) out.push("The confirmation needs a title.");
    return [...new Set(out)];
  }, [name, questions, confirm]);

  const save = useApiMutation(() => api.cancelFlows.update(appId, flow.id, { name: name.trim(), steps }), {
    success: "Cancel flow saved",
    invalidate: [keys.cancelFlows(appId)],
    onSuccess: () => router.push(`/apps/${appId}/cancel-flow`),
  });

  const back = `/apps/${appId}/cancel-flow`;
  const planList = plans.data ?? [];
  const incentiveList = incentives.data ?? [];

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Cancel Flow", href: back, icon: <DoorOpen /> }]}
        title="Edit"
        actions={
          <>
            <Link href={back} className={buttonVariants()}>
              Cancel
            </Link>
            <Button variant="primary" disabled={problems.length > 0} loading={save.isPending} onClick={() => save.mutate()}>
              <Save />
              Save Flow
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="mx-auto flex w-full max-w-[1220px] gap-10 px-8 py-8">
          <div className="min-w-0 flex-1">
            <Section title="Details" description="How the flow is named in the dashboard. Customers don't see it.">
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cancel flow" />
              </Field>
            </Section>

            <Section
              title="Questions"
              description="Asked first, in order. Answers decide which save offer shows and appear in your results and webhooks."
              actions={
                <>
                  <Button size="sm" onClick={() => addStep("question")}>
                    <Plus />
                    Question
                  </Button>
                  <Button size="sm" onClick={() => addStep("text")}>
                    <MessageSquareText />
                    Free Text
                  </Button>
                </>
              }
            >
              <div className="flex flex-col gap-4">
                {questions.length === 0 ? (
                  <p className="text-sm text-fg-tertiary">No questions: customers go straight to the offer.</p>
                ) : null}
                {questions.map((q, i) => (
                  <StepCard
                    key={q.id}
                    label={q.type === "question" ? `Question ${i + 1}` : `Free text ${i + 1}`}
                    onUp={i > 0 ? () => moveStep(q.id, -1) : undefined}
                    onDown={i < questions.length - 1 ? () => moveStep(q.id, 1) : undefined}
                    onRemove={() => removeStep(q.id)}
                  >
                    <Field label="Question">
                      <Input
                        value={q.title}
                        onChange={(e) => update(q.id, (s) => ({ ...s, title: e.target.value }) as CancelFlowStep)}
                        placeholder={q.type === "question" ? "Why are you cancelling?" : "Anything we could have done better?"}
                      />
                    </Field>
                    <Field label="Description" hint="(optional)">
                      <Input
                        value={q.description ?? ""}
                        onChange={(e) => update(q.id, (s) => ({ ...s, description: e.target.value }) as CancelFlowStep)}
                      />
                    </Field>
                    {q.type === "question" ? (
                      <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-4 gap-y-2 text-xs text-fg-tertiary">
                          <span>Answer</span>
                          <span title="Shows a text box for more detail">Ask for details</span>
                          <span title="Goes straight to the confirmation">Skip offer</span>
                          <span />
                          {q.answers.map((a) => (
                            <AnswerRow
                              key={a.id}
                              answer={a}
                              skips={skipsOffer(a)}
                              canRemove={q.answers.length > 2}
                              onLabel={(label) => setAnswerLabel(q.id, a.id, label)}
                              onText={(text) => setAnswers(q.id, (all) => all.map((x) => (x.id === a.id ? { ...x, text: text || undefined } : x)))}
                              onSkip={(skip) =>
                                setAnswers(q.id, (all) => all.map((x) => (x.id === a.id ? { ...x, next: skip ? confirm.id : null } : x)))
                              }
                              onRemove={() => setAnswers(q.id, (all) => all.filter((x) => x.id !== a.id))}
                            />
                          ))}
                        </div>
                        <Button
                          size="xs"
                          className="self-start"
                          disabled={q.answers.length >= 12}
                          onClick={() => {
                            const id = uniqueId(`${q.id}_answer`, takenIds());
                            setFresh((f) => new Set([...f, id]));
                            setAnswers(q.id, (all) => [...all, { id, label: "" }]);
                          }}
                        >
                          <Plus />
                          Answer
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
                        <Field label="Placeholder" hint="(optional)">
                          <Input
                            value={q.placeholder ?? ""}
                            onChange={(e) => update(q.id, (s) => ({ ...s, placeholder: e.target.value }) as CancelFlowStep)}
                          />
                        </Field>
                        <label className="flex h-9 items-center gap-2 text-sm text-fg">
                          <Checkbox
                            checked={!!q.required}
                            onCheckedChange={(on) => update(q.id, (s) => ({ ...s, required: on }) as CancelFlowStep)}
                          />
                          Required
                        </label>
                      </div>
                    )}
                  </StepCard>
                ))}
              </div>
            </Section>

            <Section
              title="Save Offer"
              description="Shown after the questions, before the customer can cancel. Skipped when nothing applies to them."
              actions={<Switch checked={!!offer} onCheckedChange={toggleOffer} aria-label="Make a save offer" />}
            >
              {offer ? (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Eyebrow" hint="(optional)">
                      <Input value={offer.title ?? ""} onChange={(e) => updateOffer((s) => ({ ...s, title: e.target.value }))} placeholder="Before you go" />
                    </Field>
                    <Field label="Decline button">
                      <Input
                        value={offer.decline_label ?? ""}
                        onChange={(e) => updateOffer((s) => ({ ...s, decline_label: e.target.value }))}
                        placeholder="No thanks, continue cancelling"
                      />
                    </Field>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-fg">Offer for Each Answer</h3>
                      <p className="text-sm text-fg-tertiary">
                        The first answer with an offer wins. {offer.dynamic ? "Used when the agent can't decide." : ""}
                      </p>
                    </div>
                    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                      {allAnswers
                        .filter((a) => !skipsOffer(a))
                        .map((a) => (
                          <SpecRow
                            key={a.id}
                            label={a.label || "Untitled answer"}
                            hint={a.question}
                            spec={offer.by_answer[a.id] ?? null}
                            plans={planList}
                            incentives={incentiveList}
                            onChange={(spec) =>
                              updateOffer((s) => {
                                const rest = Object.fromEntries(Object.entries(s.by_answer).filter(([id]) => id !== a.id));
                                return { ...s, by_answer: spec ? { ...rest, [a.id]: spec } : rest };
                              })
                            }
                          />
                        ))}
                      <SpecRow
                        label="Everyone else"
                        hint="Answers without their own offer"
                        spec={offer.default}
                        plans={planList}
                        incentives={incentiveList}
                        onChange={(spec) => updateOffer((s) => ({ ...s, default: spec }))}
                      />
                    </div>
                  </div>

                  <DynamicOffers
                    offer={offer}
                    available={capabilities?.dynamic_offers ?? true}
                    plans={planList}
                    incentives={incentiveList}
                    onChange={updateOffer}
                  />
                  {!capabilities?.pause_workflows ? (
                    <p className="text-xs text-fg-tertiary">
                      Pauses resume on schedule from the API itself. Set RENDER_API_KEY on the API to run them as Render Workflow tasks
                      instead.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-fg-tertiary">No offer: customers go from the questions to the confirmation.</p>
              )}
            </Section>

            <Section title="Confirmation" description="The last step. Pressing the button cancels the PayPal subscription and moves the account to the free plan.">
              <div className="flex flex-col gap-4">
                <Field label="Title">
                  <Input value={confirm.title} onChange={(e) => update(confirm.id, (s) => ({ ...s, title: e.target.value }) as CancelFlowStep)} />
                </Field>
                <Field label="Description" hint="(optional)">
                  <Textarea
                    rows={2}
                    value={confirm.description ?? ""}
                    onChange={(e) => update(confirm.id, (s) => ({ ...s, description: e.target.value }) as CancelFlowStep)}
                  />
                </Field>
                <Field label="Button">
                  <Input
                    value={confirm.cta ?? ""}
                    placeholder="Cancel subscription"
                    onChange={(e) => update(confirm.id, (s) => ({ ...s, cta: e.target.value }) as CancelFlowStep)}
                  />
                </Field>
              </div>
            </Section>

            {problems.length ? (
              <Callout tone="warning" title="Before you can save">
                <ul className="list-disc pl-4">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}
          </div>

          <aside className="sticky top-8 hidden w-[400px] shrink-0 self-start xl:block">
            <PreviewPanel appId={appId} flowId={flow.id} name={name} steps={steps} answers={allAnswers} dynamic={!!offer?.dynamic} />
          </aside>
        </div>
        <div className="border-t border-border px-8 py-6 xl:hidden">
          <PreviewPanel appId={appId} flowId={flow.id} name={name} steps={steps} answers={allAnswers} dynamic={!!offer?.dynamic} />
        </div>
      </PageBody>
    </>
  );
}

function StepCard({
  label,
  children,
  onUp,
  onDown,
  onRemove,
}: {
  label: string;
  children: ReactNode;
  onUp?: () => void;
  onDown?: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-4">
      <div className="-mb-1 flex items-center justify-between">
        <span className="eyebrow text-fg-tertiary">{label}</span>
        <div className="flex items-center gap-1">
          <Button size="xs" icon variant="ghost" aria-label="Move up" disabled={!onUp} onClick={onUp}>
            <ArrowUp />
          </Button>
          <Button size="xs" icon variant="ghost" aria-label="Move down" disabled={!onDown} onClick={onDown}>
            <ArrowDown />
          </Button>
          <Button size="xs" icon variant="ghost" aria-label="Remove" onClick={onRemove}>
            <Trash2 />
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}

function AnswerRow({
  answer,
  skips,
  canRemove,
  onLabel,
  onText,
  onSkip,
  onRemove,
}: {
  answer: CancelFlowAnswer;
  skips: boolean;
  canRemove: boolean;
  onLabel(label: string): void;
  onText(on: boolean): void;
  onSkip(on: boolean): void;
  onRemove(): void;
}) {
  return (
    <>
      <Input size="sm" value={answer.label} onChange={(e) => onLabel(e.target.value)} placeholder="It's too expensive" />
      <span className="flex justify-center">
        <Checkbox aria-label="Ask for details" checked={!!answer.text} onCheckedChange={onText} />
      </span>
      <span className="flex justify-center">
        <Checkbox aria-label="Skip the offer" checked={skips} onCheckedChange={onSkip} />
      </span>
      <Button size="xs" icon variant="ghost" aria-label="Remove answer" disabled={!canRemove} onClick={onRemove}>
        <X />
      </Button>
    </>
  );
}

const num = (v: string, fallback: number) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

function SpecRow({
  label,
  hint,
  spec,
  plans,
  incentives,
  onChange,
}: {
  label: string;
  hint?: string;
  spec: SaveOfferSpec | null;
  plans: Plan[];
  incentives: Incentive[];
  onChange(spec: SaveOfferSpec | null): void;
}) {
  const setKind = (kind: SaveOfferKind | "none") => {
    if (kind === "none") return onChange(null);
    if (kind === "discount") return onChange({ kind, percent: 30, cycles: 3 });
    if (kind === "pause") return onChange({ kind, months: 2 });
    if (kind === "downgrade") return onChange({ kind, plan: plans.find((p) => !p.isFree && p.pricingCard)?.id ?? plans[0]?.id ?? "" });
    onChange({ kind, incentive: incentives[0]?.id ?? "", months: 2 });
  };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_136px_minmax(250px,1.4fr)] items-center gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm text-fg">{label}</div>
        {hint ? <div className="truncate text-xs text-fg-tertiary">{hint}</div> : null}
      </div>
      <Select
        size="sm"
        aria-label={`Offer for ${label}`}
        value={spec?.kind ?? "none"}
        onValueChange={setKind}
        options={[
          { value: "none", label: "No offer" },
          ...KINDS.map((k) => ({
            value: k,
            label: KIND_LABELS[k],
            disabled: (k === "incentive" && !incentives.length) || (k === "downgrade" && plans.length < 2),
          })),
        ]}
      />
      <div className="flex items-center gap-2 whitespace-nowrap text-sm text-fg-tertiary">
        {spec?.kind === "discount" ? (
          <>
            <Input size="sm" type="number" min={1} max={90} className="w-[60px]" value={spec.percent} onChange={(e) => onChange({ ...spec, percent: num(e.target.value, 1) })} />
            % off for
            <Input size="sm" type="number" min={1} max={24} className="w-[52px]" value={spec.cycles} onChange={(e) => onChange({ ...spec, cycles: num(e.target.value, 1) })} />
            payments
          </>
        ) : spec?.kind === "pause" ? (
          <>
            <Input size="sm" type="number" min={1} max={12} className="w-14" value={spec.months} onChange={(e) => onChange({ ...spec, months: num(e.target.value, 1) })} />
            months
          </>
        ) : spec?.kind === "downgrade" ? (
          <Select
            size="sm"
            aria-label="Plan"
            value={spec.plan}
            onValueChange={(plan) => onChange({ ...spec, plan })}
            options={plans.filter((p) => !p.isFree).map((p) => ({ value: p.id, label: p.name }))}
          />
        ) : spec?.kind === "incentive" ? (
          <>
            <Select
              size="sm"
              aria-label="Incentive"
              value={spec.incentive}
              onValueChange={(incentive) => onChange({ ...spec, incentive })}
              options={incentives.map((i) => ({ value: i.id, label: i.name ?? i.id }))}
            />
            for
            <Input size="sm" type="number" min={1} max={24} className="w-14 shrink-0" value={spec.months} onChange={(e) => onChange({ ...spec, months: num(e.target.value, 1) })} />
            mo
          </>
        ) : (
          <span className="truncate">Goes straight to the confirmation</span>
        )}
      </div>
    </div>
  );
}

function DynamicOffers({
  offer,
  available,
  plans,
  incentives,
  onChange,
}: {
  offer: OfferStep;
  available: boolean;
  plans: Plan[];
  incentives: Incentive[];
  onChange(fn: (s: OfferStep) => OfferStep): void;
}) {
  const g = offer.guardrails;
  const setG = (patch: Partial<SaveOfferGuardrails>) => onChange((s) => ({ ...s, guardrails: { ...s.guardrails, ...patch } }));
  const toggleIn = (list: string[], id: string, on: boolean) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id));
  return (
    <div className={cn("flex flex-col gap-4 rounded-xl border p-4", offer.dynamic ? "border-accent/40 bg-accent-subtle/40" : "border-border")}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-accent-contrast [&_svg]:size-4">
          <Sparkles />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-fg">Dynamic Offers</h3>
            {offer.dynamic ? <Badge color="brand">On</Badge> : null}
          </div>
          <p className="text-sm text-fg-tertiary">
            The agent reads why this customer is leaving, their plan, tenure and usage, then picks the offer most likely to keep them and
            writes its copy. It can only choose within the limits below; the API enforces them.
          </p>
        </div>
        <Switch checked={offer.dynamic} onCheckedChange={(on) => onChange((s) => ({ ...s, dynamic: on }))} aria-label="Dynamic offers" />
      </div>
      {offer.dynamic && !available ? (
        <Callout tone="warning">Set ANTHROPIC_API_KEY on the API to turn this on. Until then customers get the offer for their answer.</Callout>
      ) : null}
      {offer.dynamic ? (
        <div className="flex flex-col gap-4">
          <Field label="Agent may offer">
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <label key={k} className="flex items-start gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm">
                  <Checkbox className="mt-0.5" checked={g.kinds.includes(k)} onCheckedChange={(on) => setG({ kinds: toggleIn(g.kinds, k, on) as SaveOfferKind[] })} />
                  <span>
                    <span className="font-medium text-fg">{KIND_LABELS[k]}</span>
                    <span className="block text-xs text-fg-tertiary">{KIND_DESCRIPTIONS[k]}</span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Max % off">
              <Input size="sm" type="number" min={1} max={90} value={g.max_discount_percent} onChange={(e) => setG({ max_discount_percent: num(e.target.value, 1) })} />
            </Field>
            <Field label="Max payments">
              <Input size="sm" type="number" min={1} max={24} value={g.max_discount_cycles} onChange={(e) => setG({ max_discount_cycles: num(e.target.value, 1) })} />
            </Field>
            <Field label="Max pause (mo)">
              <Input size="sm" type="number" min={1} max={12} value={g.max_pause_months} onChange={(e) => setG({ max_pause_months: num(e.target.value, 1) })} />
            </Field>
            <Field label="Max bonus (mo)">
              <Input size="sm" type="number" min={1} max={24} value={g.max_incentive_months} onChange={(e) => setG({ max_incentive_months: num(e.target.value, 1) })} />
            </Field>
          </div>
          {g.kinds.includes("incentive") ? (
            <Field label="Incentives it can give" description={incentives.length ? undefined : "Create an incentive first."}>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {incentives.map((i) => (
                  <label key={i.id} className="flex items-center gap-2 text-sm text-fg">
                    <Checkbox checked={g.incentives.includes(i.id)} onCheckedChange={(on) => setG({ incentives: toggleIn(g.incentives, i.id, on) })} />
                    {i.name ?? i.id}
                  </label>
                ))}
              </div>
            </Field>
          ) : null}
          {g.kinds.includes("downgrade") ? (
            <Field label="Plans it can move them to" description="None checked: any cheaper plan.">
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {plans
                  .filter((p) => !p.isFree)
                  .map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm text-fg">
                      <Checkbox checked={g.downgrade_plans.includes(p.id)} onCheckedChange={(on) => setG({ downgrade_plans: toggleIn(g.downgrade_plans, p.id, on) })} />
                      {p.name}
                    </label>
                  ))}
              </div>
            </Field>
          ) : null}
          <Field label="Instructions" hint="(optional)" description="Your voice, and anything the agent should know about your customers.">
            <Textarea
              rows={3}
              value={g.instructions}
              onChange={(e) => setG({ instructions: e.target.value })}
              placeholder="Friendly and brief. Agencies churn after projects end, so offer them a pause."
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

function PreviewPanel({
  appId,
  flowId,
  name,
  steps,
  answers,
  dynamic,
}: {
  appId: string;
  flowId: string;
  name: string;
  steps: CancelFlowStep[];
  answers: (CancelFlowAnswer & { question: string })[];
  dynamic: boolean;
}) {
  const debounced = useDebounced(steps, 500);
  const [startAt, setStartAt] = useState<string>("start");
  const [answer, setAnswer] = useState<string>("");
  const [account, setAccount] = useState("");
  const accountDebounced = useDebounced(account.trim(), 600);
  const [useClaude, setUseClaude] = useState(false);
  const [result, setResult] = useState<{ preview: CancelOfferPreview | null; error?: string } | null>(null);

  const jumpable = debounced.filter((s) => s.type === "offer" || s.type === "confirm");
  const pickedAnswer = answers.some((a) => a.id === answer) ? answer : "";
  const offerShown = result?.preview?.offer;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">Preview</h3>
        <span className="text-xs text-fg-tertiary">Nothing is saved or charged</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select
          size="sm"
          aria-label="Start at"
          value={jumpable.some((s) => s.id === startAt) ? startAt : "start"}
          onValueChange={setStartAt}
          options={[
            { value: "start", label: "From the start" },
            ...jumpable.map((s) => ({ value: s.id, label: s.type === "offer" ? "Jump to offer" : "Jump to confirmation" })),
          ]}
        />
        <Select
          size="sm"
          aria-label="Assumed answer"
          value={pickedAnswer || "none"}
          onValueChange={(v) => setAnswer(v === "none" ? "" : v)}
          options={[{ value: "none", label: "No answer" }, ...answers.map((a) => ({ value: a.id, label: a.label || a.id }))]}
        />
      </div>
      <div className="flex items-center gap-2">
        <Input size="sm" placeholder="Price for account ID (optional)" value={account} onChange={(e) => setAccount(e.target.value)} />
        {dynamic ? (
          <label className="flex shrink-0 items-center gap-2 text-xs text-fg-secondary" title="Calls the agent for each preview">
            <Switch checked={useClaude} onCheckedChange={setUseClaude} aria-label="Ask the agent" />
            Ask the agent
          </label>
        ) : null}
      </div>
      <CancelFlowPreview
        appId={appId}
        flowId={flowId}
        name={name}
        steps={debounced}
        startAt={startAt === "start" ? null : startAt}
        answers={pickedAnswer ? [pickedAnswer] : []}
        account={accountDebounced || null}
        useClaude={dynamic && useClaude}
        onOffer={(preview, error) => setResult({ preview, error })}
      />
      {result?.error ? (
        <p className="flex gap-2 text-xs text-danger-fg">
          <CircleAlert className="size-3.5 shrink-0" />
          {result.error}
        </p>
      ) : result?.preview ? (
        <div className="flex flex-col gap-1 rounded-lg bg-bg-subtle px-3 py-2 text-xs text-fg-tertiary">
          <span>
            {offerShown ? (
              <>
                {offerShown.source === "dynamic" ? "Agent picked" : "Fixed offer"}: <span className="text-fg">{KIND_LABELS[offerShown.kind]}</span>
              </>
            ) : (
              "No offer applies; the step is skipped."
            )}{" "}
            · priced for {result.preview.account?.id === "sample" ? `a sample ${result.preview.account.plan_name} customer` : result.preview.account?.id}
          </span>
          {offerShown?.reasoning ? <span className="text-fg-secondary">“{offerShown.reasoning}”</span> : null}
          {result.preview.dynamic && !result.preview.dynamic.used ? <span>Agent skipped: {result.preview.dynamic.skipped}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
