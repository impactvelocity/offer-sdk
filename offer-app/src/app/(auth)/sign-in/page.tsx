import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DEMO_USER, demoEnabled, getSession, needsSetup } from "@/server/auth";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getSession()) redirect("/apps");
  // A fresh install has no one to sign in as yet.
  if (await needsSetup()) redirect("/setup");
  return (
    <Suspense>
      <AuthForm mode="sign-in" demo={demoEnabled ? { email: DEMO_USER.email, password: DEMO_USER.password } : undefined} />
    </Suspense>
  );
}
