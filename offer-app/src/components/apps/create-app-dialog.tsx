"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Box, GraduationCap, LayoutGrid, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { keys, useApiMutation } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

type Start = "blank" | "saas" | "course";

const starts: { value: Start; title: string; description: string; icon: ReactNode }[] = [
  { value: "blank", title: "Blank app", description: "Start from an empty catalog.", icon: <Box /> },
  {
    value: "saas",
    title: "SaaS sample",
    description: "Free, Starter, Pro and Enterprise plans with usage limits, add-ons and promos.",
    icon: <Sparkles />,
  },
  {
    value: "course",
    title: "Course sample",
    description: "One-time access tiers for an online course or community.",
    icon: <GraduationCap />,
  },
];

export function CreateAppDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [start, setStart] = useState<Start>("blank");

  const create = useApiMutation((input: { name: string; sample: "saas" | "course" | null }) => api.workspace.createApp(input), {
    invalidate: [keys.apps],
    success: (app) => `${app.name} created`,
    onSuccess: (app) => {
      onOpenChange(false);
      setName("");
      setStart("blank");
      router.push(`/apps/${app.id}`);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), sample: start === "blank" ? null : start });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit}>
          <DialogHeader icon={<LayoutGrid />} title="Create app" />
          <DialogBody>
            <p className="-mt-1 text-sm text-fg-tertiary">
              An app is one product you control access for. It gets its own plans, accounts and API keys.
            </p>
            <Field label="App name">
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Notebook AI" />
            </Field>
            <Field label="Start with">
              <RadioGroup value={start} onValueChange={(v) => setStart(v as Start)} className="flex flex-col gap-2">
                {starts.map((s) => (
                  <Radio.Root
                    key={s.value}
                    value={s.value}
                    nativeButton
                    render={<button type="button" />}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border border-border bg-bg p-3 text-left outline-none transition-[border-color,box-shadow] hover:border-border-strong focus-visible:shadow-[0_0_0_3px_var(--ring)] data-checked:border-accent data-checked:shadow-[0_0_0_1px_var(--accent)]",
                    )}
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-bg-muted text-fg-secondary [&_svg]:size-4">
                      {s.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-fg">{s.title}</span>
                      <span className="block text-sm text-fg-tertiary">{s.description}</span>
                    </span>
                    <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong">
                      <Radio.Indicator className="size-2 rounded-full bg-accent" />
                    </span>
                  </Radio.Root>
                ))}
              </RadioGroup>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} kbd="Esc">
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={create.isPending} disabled={!name.trim()} kbd="↵">
              Create app
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
