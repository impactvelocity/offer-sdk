"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signIn, signUp } from "@/lib/auth-client";

/** Sign-in, or "setup": the one-time admin account for a fresh install. */
export function AuthForm({ mode, demo }: { mode: "sign-in" | "setup"; demo?: { email: string; password: string } }) {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get("next");
  // Same-site paths only ("//host" would leave the dashboard).
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
  // /demo-account (or ?demo) opens sign-in with the demo login filled in.
  const prefill = demo && params.has("demo") ? demo : null;
  const [name, setName] = useState("");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [password, setPassword] = useState(prefill?.password ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"form" | "demo" | null>(null);

  const finish = () => {
    // The new admin goes on to create the first workspace.
    router.push(mode === "setup" ? "/onboarding" : (next ?? "/apps"));
    router.refresh();
  };

  /** Builds the demo workspace the first time (a few seconds). False after showing an error. */
  async function prepareDemo() {
    const ready = await fetch("/api/demo-workspace", { method: "POST" }).catch(() => null);
    if (ready?.ok) return true;
    const body = (await ready?.json().catch(() => null)) as { error?: string } | null;
    setError(body?.error ?? "Couldn't reach the dashboard");
    return false;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending("form");
    if (mode === "sign-in" && demo && email.trim().toLowerCase() === demo.email && !(await prepareDemo())) {
      setPending(null);
      return;
    }
    const { error } =
      mode === "sign-in"
        ? await signIn.email({ email, password })
        : await signUp.email({ name: name || email.split("@")[0], email, password });
    if (mode === "setup" && error?.status === 403) {
      // Someone finished setup first.
      router.replace("/sign-in");
      return;
    }
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
    if (!(await prepareDemo())) {
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
          {mode === "sign-in" ? "Sign in to Offer SDK" : "Set up Offer SDK"}
        </h1>
        <p className="mt-1 text-sm text-fg-tertiary">
          {mode === "sign-in"
            ? "Manage entitlements, plans and offers for your product."
            : "Create the admin account for this install. It's the only account, so keep the password somewhere safe."}
        </p>

        {demo && mode === "sign-in" ? (
          <Callout
            className="mt-5"
            title={
              <span className="flex items-center justify-between gap-3">
                Demo account
                <Button
                  variant="link"
                  onClick={() => {
                    setEmail(demo.email);
                    setPassword(demo.password);
                  }}
                  disabled={pending !== null || (email === demo.email && password === demo.password)}
                >
                  Fill in
                </Button>
              </span>
            }
          >
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt>Email</dt>
              <dd className="font-mono text-fg">{demo.email}</dd>
              <dt>Password</dt>
              <dd className="font-mono text-fg">{demo.password}</dd>
            </dl>
            <p className="mt-2 text-fg-tertiary">Shared and read-only: explore the sample apps and data, but changes are turned off.</p>
          </Callout>
        ) : null}

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          {mode === "setup" ? (
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
          <Field label="Password" description={mode === "setup" ? "At least 8 characters." : undefined}>
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
            {mode === "sign-in" ? "Continue" : "Create admin account"}
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
    </div>
  );
}
