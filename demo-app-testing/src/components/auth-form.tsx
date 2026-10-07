"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ErrorExplanation } from "./flash";

// Devise's sessions/new and registrations/new, on better-auth.
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(form: FormData) {
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setBusy(true);
    setErrors([]);
    if (mode === "signup") {
      const problems: string[] = [];
      if (!email) problems.push("Email can't be blank");
      if (password.length < 6) problems.push("Password is too short (minimum is 6 characters)");
      if (password !== form.get("password_confirmation")) problems.push("Password confirmation doesn't match Password");
      if (problems.length) {
        setErrors(problems);
        setBusy(false);
        return;
      }
    }
    const { error } =
      mode === "signup"
        ? await authClient.signUp.email({ email, password, name: String(form.get("name") || email.split("@")[0]) })
        : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (error) {
      setErrors([error.message ?? "Something went wrong"]);
      return;
    }
    router.push(`/?notice=${mode === "signup" ? "Welcome!+You+have+signed+up+successfully." : "Signed+in+successfully."}`);
    router.refresh();
  }

  return (
    <>
      <h2>{mode === "signup" ? "Sign up" : "Log in"}</h2>
      <ErrorExplanation errors={errors} model="user" />
      <form action={submit}>
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="name">Name</label>
            <br />
            <input id="name" name="name" type="text" autoComplete="name" />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <br />
          <input id="email" name="email" type="email" autoComplete="email" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          {mode === "signup" && <i className="muted"> (6 characters minimum)</i>}
          <br />
          <input id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        </div>
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="password_confirmation">Password confirmation</label>
            <br />
            <input id="password_confirmation" name="password_confirmation" type="password" autoComplete="new-password" />
          </div>
        )}
        <div className="actions">
          <input type="submit" value={mode === "signup" ? "Sign up" : "Log in"} disabled={busy} />
        </div>
      </form>
      {mode === "signup" ? <Link href="/login">Log in</Link> : <Link href="/signup">Sign up</Link>}
    </>
  );
}
