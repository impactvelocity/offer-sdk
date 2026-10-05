import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { getSession, listWorkspaces, setActiveWorkspace } from "@/server/auth";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Create a workspace" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const isNew = (await searchParams).new === "1";
  const orgs = await listWorkspaces();
  if (orgs.length && !isNew) {
    // Has workspaces but none active (e.g. session predates them): activate the first.
    await setActiveWorkspace(orgs[0].id);
    redirect("/apps");
  }

  return (
    <div className="flex min-h-full flex-col bg-bg-subtle bg-brand-glow">
      <header className="flex h-16 items-center justify-center">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-[6vh]">
        <OnboardingForm userName={session.user.name} canCancel={orgs.length > 0} />
      </main>
    </div>
  );
}
