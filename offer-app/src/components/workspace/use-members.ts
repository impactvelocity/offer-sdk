"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceContext } from "@/components/shell/workspace-context";
import { authClient } from "@/lib/auth-client";
import { unwrap } from "./unwrap";

export type Role = "owner" | "admin" | "member";

export const membersKey = (workspaceId: string) => ["workspace", workspaceId, "members"] as const;

/** Members can hold several comma-separated roles; reduce to the most powerful one. */
export function primaryRole(role: string | undefined | null): Role {
  const roles = (role ?? "").split(",").map((r) => r.trim());
  return roles.includes("owner") ? "owner" : roles.includes("admin") ? "admin" : "member";
}

/** The active workspace with its members and invitations, plus the current user's membership. */
export function useWorkspaceMembers() {
  const { workspace, user } = useWorkspaceContext();
  const query = useQuery({
    queryKey: membersKey(workspace.id),
    queryFn: async () => {
      const org = await unwrap(authClient.organization.getFullOrganization({ query: { organizationId: workspace.id } }));
      if (!org) throw new Error("Workspace not found");
      return org;
    },
  });
  const me = query.data?.members.find((m) => m.userId === user.id);
  const role = me ? primaryRole(me.role) : undefined;
  return { ...query, me, role, canManage: role === "owner" || role === "admin" };
}
