"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

export interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface WorkspaceOrg {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
}

interface WorkspaceContextValue {
  user: WorkspaceUser;
  workspace: WorkspaceOrg;
  workspaces: WorkspaceOrg[];
  /** Signed in as the shared, read-only demo login (see @/lib/demo). */
  demo: boolean;
  switchWorkspace: (id: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspaceContext() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspaceContext must be used within <WorkspaceProvider>");
  return ctx;
}

/** True on the shared demo login. False outside a workspace layout. */
export function useIsDemo() {
  return useContext(WorkspaceContext)?.demo ?? false;
}

export function WorkspaceProvider({
  user,
  workspace,
  workspaces,
  demo,
  children,
}: Omit<WorkspaceContextValue, "switchWorkspace" | "signOut"> & { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const switchWorkspace = useCallback(
    async (organizationId: string) => {
      await authClient.organization.setActive({ organizationId });
      queryClient.clear();
      router.push("/apps");
      router.refresh();
    },
    [queryClient, router],
  );

  const signOut = useCallback(async () => {
    await authClient.signOut();
    queryClient.clear();
    router.push("/sign-in");
    router.refresh();
  }, [queryClient, router]);

  return (
    <WorkspaceContext.Provider value={{ user, workspace, workspaces, demo, switchWorkspace, signOut }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
