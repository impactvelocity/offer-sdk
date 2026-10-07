"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const slug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function OnboardingForm({ userName, canCancel }: { userName: string; canCancel: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const base = slug(name) || "workspace";
    const { data, error } = await authClient.organization.create({
      name: name.trim(),
      slug: `${base}-${Math.random().toString(36).slice(2, 6)}`,
    });
    if (error || !data) {
      setError(error?.message ?? "Couldn't create the workspace");
      setPending(false);
      return;
    }
    await authClient.organization.setActive({ organizationId: data.id });
    router.push("/apps?new=1");
    router.refresh();
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="rounded-xl border border-border bg-bg p-6 shadow-sm">
        <p className="text-sm text-fg-tertiary">Welcome, {userName.split(" ")[0]}</p>
        <h1 className="mt-1 font-display text-xl font-semibold text-fg">Create your workspace</h1>
        <p className="mt-1 text-sm text-fg-tertiary">
          A workspace holds your apps. Each app gets its own catalog, accounts and API keys.
        </p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <Field label="Workspace name" error={error}>
            <Input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." />
          </Field>
          <div className="flex items-center gap-2">
            {canCancel ? (
              <Button size="md" onClick={() => router.back()}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit" variant="primary" size="md" loading={pending} disabled={!name.trim()} className="flex-1">
              Continue
              <ArrowRight />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
