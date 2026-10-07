import type { CancelFlowStep, PresentedSaveOffer } from "@/lib/api/types";
import type { CancelSession, CancelStep, CancelTransport } from "@/sdk/cancel";

// A stand-in for the API that walks a draft flow in the browser, so the
// editor can show the real SDK components on unsaved changes. Only the offer
// comes from the API (preview-offer), so prices and copy match production.
// Nothing is saved and nobody is charged.

export interface PreviewOptions {
  name: string;
  steps: CancelFlowStep[];
  /** Start here instead of the first step (answers default to `answers`). */
  startAt?: string | null;
  /** Answers assumed for steps skipped by `startAt`. */
  answers?: string[];
  offerFor(answers: string[], texts: Record<string, string>): Promise<PresentedSaveOffer | null>;
  account?: CancelSession["account"];
}

function publicStep(step: CancelFlowStep): CancelStep {
  switch (step.type) {
    case "question":
      return {
        id: step.id,
        type: "question",
        title: step.title,
        description: step.description ?? null,
        answers: step.answers.map((a) => ({ id: a.id, label: a.label, text: !!a.text })),
      };
    case "text":
      return {
        id: step.id,
        type: "text",
        title: step.title,
        description: step.description ?? null,
        placeholder: step.placeholder ?? null,
        required: !!step.required,
      };
    case "offer":
      return { id: step.id, type: "offer", title: step.title ?? null, decline_label: step.decline_label ?? null };
    case "confirm":
      return { id: step.id, type: "confirm", title: step.title, description: step.description ?? null, cta: step.cta ?? null };
  }
}

export function nextStepId(steps: CancelFlowStep[], step: CancelFlowStep, answerId?: string | null): string | null {
  if (step.type === "confirm") return null;
  const answer = step.type === "question" ? step.answers.find((a) => a.id === answerId) : null;
  const explicit = answer?.next ?? step.next;
  if (explicit) return explicit;
  const i = steps.findIndex((s) => s.id === step.id);
  return steps[i + 1]?.id ?? steps.find((s) => s.type === "confirm")?.id ?? null;
}

export function previewTransport(opts: PreviewOptions): CancelTransport {
  const { steps } = opts;
  const state = {
    current: ((opts.startAt && steps.some((s) => s.id === opts.startAt) ? opts.startAt : steps[0]?.id) ?? null) as string | null,
    status: "open" as CancelSession["status"],
    history: [] as string[],
    answers: new Map<string, { answer: string | null; text: string | null }>(),
    offer: null as PresentedSaveOffer | null,
    result: null as CancelSession["result"],
  };
  const find = (id: string | null) => steps.find((s) => s.id === id) ?? null;
  const answerIds = () => {
    const given = [...state.answers.values()].flatMap((a) => (a.answer ? [a.answer] : []));
    return given.length ? given : (opts.answers ?? []);
  };
  const texts = () =>
    Object.fromEntries([...state.answers.values()].flatMap((a) => (a.answer && a.text ? [[a.answer, a.text]] : [])));

  async function enter(id: string | null): Promise<void> {
    const step = find(id);
    state.current = step?.id ?? null;
    if (step?.type !== "offer" || state.offer) return;
    state.offer = await opts.offerFor(answerIds(), texts());
    if (!state.offer) return enter(nextStepId(steps, step));
  }

  const view = (): CancelSession => {
    const step = state.status === "open" ? find(state.current) : null;
    return {
      id: "preview",
      status: state.status,
      flow: { id: "preview", name: opts.name },
      step: step ? publicStep(step) : null,
      progress: { index: step ? steps.indexOf(step) : steps.length, total: steps.length },
      can_go_back: state.status === "open" && state.history.length > 0,
      offer: step?.type === "offer" || state.status === "saved" ? state.offer : null,
      approve_url: null,
      result: state.result,
      account: opts.account ?? { id: "sample", plan_name: "Pro", subscription: null },
    };
  };

  return {
    async start() {
      await enter(state.current);
      return view();
    },
    async answer(_id, body) {
      const step = find(state.current);
      if (!step) return view();
      state.answers.set(step.id, { answer: body.answer ?? null, text: body.text ?? null });
      state.history.push(step.id);
      state.offer = null;
      await enter(nextStepId(steps, step, body.answer));
      return view();
    },
    async back() {
      const previous = state.history.pop();
      if (previous) state.current = previous;
      if (state.offer?.status === "declined") state.offer = { ...state.offer, status: "shown" };
      return view();
    },
    async decline() {
      const step = find(state.current);
      if (state.offer) state.offer = { ...state.offer, status: "declined" };
      if (step) {
        state.history.push(step.id);
        await enter(nextStepId(steps, step));
      }
      return view();
    },
    async accept() {
      if (state.offer) state.offer = { ...state.offer, status: "accepted" };
      state.status = "saved";
      state.result = { outcome: "saved", preview: true };
      return view();
    },
    async cancel() {
      state.status = "cancelled";
      state.result = { outcome: "cancelled", preview: true };
      return view();
    },
    async close() {
      return view();
    },
  };
}
