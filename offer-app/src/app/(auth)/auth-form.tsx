"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signIn, signUp } from "@/lib/auth-client";

export function AuthForm({ mode, demo }: { mode: "sign-in" | "sign-up"; demo?: { email: string; password: string } }) {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"form" | "demo" | null>(null);

  const finish = () => {
    router.push(next && next.startsWith("/") ? next : "/apps");
    router.refresh();
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending("form");
    const { error } =
      mode === "sign-in"
        ? await signIn.email({ email, password })
        : await signUp.email({ name: name || email.split("@")[0], email, password });
    if (error) {
      setError(error.message ?? "Something went wrong");
      setPending(null);
      return;
    }
    finish();
  }

  async function useDemo() {
    if (!demo) return;
    setError(null);
    setPending("demo");
    // Builds the demo workspace the first time (a few seconds), then signs in to it.
    const ready = await fetch("/api/demo-workspace", { method: "POST" }).catch(() => null);
    if (!ready?.ok) {
      const body = (await ready?.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Couldn't reach the dashboard");
      setPending(null);
      return;
    }
    const { error } = await signIn.email(demo);
    if (error) {
      setError(error.message ?? "Couldn't sign in to the demo account");
      setPending(null);
      return;
    }
    finish();
  }

  return (
    <div className="w-full max-w-[380px]">
      <div className="rounded-xl border border-border bg-bg p-6 shadow-sm">
        <h1 className="font-display text-xl font-semibold text-fg">
          {mode === "sign-in" ? "Sign in to Offer SDK" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-fg-tertiary">
          {mode === "sign-in"
            ? "Manage entitlements, plans and offers for your product."
            : "Start controlling access and offers without redeploying."}
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          {mode === "sign-up" ? (
            <Field label="Full name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
            </Field>
          ) : null}
          <Field label="Work email">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              autoFocus
            />
          </Field>
          <Field label="Password" description={mode === "sign-up" ? "At least 8 characters." : undefined}>
            <Input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            />
          </Field>
          {error ? (
            <p className="rounded-md bg-danger-subtle px-2.5 py-2 text-sm text-danger-fg" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" size="md" loading={pending === "form"} disabled={pending !== null} className="w-full">
            {mode === "sign-in" ? "Continue" : "Create account"}
            <ArrowRight />
          </Button>
        </form>

        {demo ? (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-fg-tertiary">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button size="md" className="w-full" onClick={useDemo} loading={pending === "demo"} disabled={pending !== null}>
              <Sparkles className="text-accent-fg" />
              Explore the demo workspace
            </Button>
          </>
        ) : null}
      </div>
      <p className="mt-4 text-center text-sm text-fg-tertiary">
        {mode === "sign-in" ? (
          <>
            New to Offer SDK?{" "}
            <Link href="/sign-up" className="font-medium text-accent-fg hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-accent-fg hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
