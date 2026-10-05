import type { Metadata } from "next";
import { env } from "@/server/env";
import { AgentView } from "./agent-view";

export const metadata: Metadata = { title: "Agent" };

export default async function AgentPage({ searchParams }: PageProps<"/apps/[appId]/agent">) {
  const { thread } = await searchParams;
  return <AgentView enabled={Boolean(env.ANTHROPIC_API_KEY)} initialThreadId={typeof thread === "string" ? thread : null} />;
}
