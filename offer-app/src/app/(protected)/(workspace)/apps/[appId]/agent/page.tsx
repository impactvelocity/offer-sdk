import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isDemoUser } from "@/server/auth";
import { env } from "@/server/env";
import { AgentView } from "./agent-view";

export const metadata: Metadata = { title: "Agent" };

export default async function AgentPage({ params, searchParams }: PageProps<"/apps/[appId]/agent">) {
  // Off on the shared demo login, which anyone can use (see @/lib/demo).
  if (isDemoUser((await getSession())?.user)) redirect(`/apps/${(await params).appId}`);
  const { thread } = await searchParams;
  return <AgentView enabled={Boolean(env.ANTHROPIC_API_KEY)} initialThreadId={typeof thread === "string" ? thread : null} />;
}
