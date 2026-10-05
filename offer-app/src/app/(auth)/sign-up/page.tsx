import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/server/auth";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (await getSession()) redirect("/apps");
  return (
    <Suspense>
      <AuthForm mode="sign-up" />
    </Suspense>
  );
}
