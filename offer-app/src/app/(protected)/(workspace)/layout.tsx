import { redirect } from "next/navigation";
import { WorkspaceProvider } from "@/components/shell/workspace-context";
import { getSession, listWorkspaces } from "@/server/auth";

export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const orgs = await listWorkspaces();
  const active = orgs.find((o) => o.id === session.session.activeOrganizationId);
  if (!active) redirect("/onboarding");

  return (
    <WorkspaceProvider
      user={{ id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image }}
      workspace={{ id: active.id, name: active.name, slug: active.slug, logo: active.logo }}
      workspaces={orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug, logo: o.logo }))}
    >
      {children}
    </WorkspaceProvider>
  );
}
