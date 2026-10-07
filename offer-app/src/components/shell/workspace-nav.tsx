"use client";

import { LayoutGrid, Settings, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { useApps } from "@/lib/api/hooks";
import { QuickActionsButton } from "./quick-actions";
import { NavGroup, NavItem, NavPanel, NavPanelBody, NavPanelHeader } from "./sidebar";
import { useWorkspaceContext } from "./workspace-context";

/** Nav panel for workspace-level pages: the apps list and settings. */
export function WorkspaceNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { workspace } = useWorkspaceContext();
  const { data: apps } = useApps();
  return (
    <NavPanel className={className}>
      <NavPanelHeader title={workspace.name} />
      <NavPanelBody>
        <div className="flex flex-col gap-0.5">
          <div className="mb-3">
            <QuickActionsButton />
          </div>
          <NavItem href="/apps" icon={<LayoutGrid />} active={pathname === "/apps"} count={apps?.length}>
            Apps
          </NavItem>
        </div>
        <NavGroup label="Settings">
          <NavItem href="/settings/workspace" icon={<Settings />} active={pathname === "/settings/workspace"}>
            General
          </NavItem>
        </NavGroup>
        <NavGroup label="Account">
          <NavItem href="/settings/profile" icon={<User />} active={pathname === "/settings/profile"}>
            Profile
          </NavItem>
        </NavGroup>
      </NavPanelBody>
    </NavPanel>
  );
}
