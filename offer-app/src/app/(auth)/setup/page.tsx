import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DEMO_USER, demoEnabled, getSession, needsSetup } from "@/server/auth";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Set up Offer SDK" };

// First visit after installing: create the admin account. One admin per install for now,
// so once it exists sign-up closes (the API enforces it) and this page sends you on.
export default async function SetupPage() {
  if (!(await needsSetup())) redirect((await getSession()) ? "/apps" : "/sign-in");
  return (
    <Suspense>
      <AuthForm mode="setup" demo={demoEnabled ? { email: DEMO_USER.email, password: DEMO_USER.password } : undefined} />
    </Suspense>
  );
}
