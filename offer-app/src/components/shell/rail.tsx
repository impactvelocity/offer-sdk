"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import {
  Check,
  ChevronRight,
  LayoutGrid,
  LogOut,
  Moon,
  Palette,
  Sun,
  Plus,
  Settings,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { popupItem, popupSurface } from "@/components/ui/popup";
import { Tooltip } from "@/components/ui/tooltip";
import { useApps } from "@/lib/api/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { THEME_OPTIONS } from "./theme-picker";
import { useWorkspaceContext } from "./workspace-context";

const tile =
  "flex size-11 items-center justify-center rounded-xl text-fg-icon outline-none transition-[background-color,box-shadow,color] hover:bg-bg/70 hover:text-fg focus-visible:shadow-[0_0_0_2px_var(--ring)] [&_svg]:size-[18px]";
const activeTile = "bg-bg text-fg shadow-soft ring-1 ring-border/70 hover:bg-bg";

function RailLink({ href, label, active, children }: { href: string; label: string; active?: boolean; children: ReactNode }) {
  return (
    <Tooltip content={label} side="right">
      <Link href={href} aria-label={label} aria-current={active ? "page" : undefined} className={cn(tile, active && activeTile)}>
        {children}
      </Link>
    </Tooltip>
  );
}

/** Rail tile that opens a menu, with a tooltip when closed. */
function RailMenu({
  label,
  trigger,
  className,
  children,
}: {
  label: string;
  trigger: ReactElement;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Menu>
      <Tooltip content={label} side="right">
        <MenuTrigger aria-label={label} className={cn(tile, "data-popup-open:bg-bg data-popup-open:shadow-soft", className)}>
          {trigger}
        </MenuTrigger>
      </Tooltip>
      <MenuContent side="right" align="start" sideOffset={8} className="w-60">
        {children}
      </MenuContent>
    </Menu>
  );
}

/**
 * First column of the shell: the logo (which opens the workspace menu), one tile per app,
 * and account controls. Switching apps is one click from anywhere.
 */
export function AppRail({ appId }: { appId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspace, workspaces, demo, switchWorkspace, signOut } = useWorkspaceContext();
  const { data: apps } = useApps();
  const theme = useTheme();

  return (
    <div className="flex h-full w-[68px] shrink-0 flex-col items-center gap-1.5 py-2.5">
      <RailMenu label={workspace.name} trigger={<LogoMark bare className="!size-[26px]" />} className="hover:bg-transparent data-popup-open:bg-transparent data-popup-open:shadow-none">
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <Avatar name={workspace.name} seed={workspace.id} size="lg" variant="solid" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{workspace.name}</div>
            <div className="truncate text-xs text-fg-tertiary">{user.email}</div>
          </div>
        </div>
        <MenuSeparator />
        <MenuItem onClick={() => router.push("/apps")}>
          <LayoutGrid />
          All apps
          {pathname === "/apps" ? <Check className="ml-auto !text-accent-fg" /> : null}
        </MenuItem>
        <MenuItem onClick={() => router.push("/apps?new=1")}>
          <Plus />
          New app
        </MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => router.push("/settings/workspace")}>
          <Settings />
          Workspace settings
        </MenuItem>
        <BaseMenu.SubmenuRoot>
          <BaseMenu.SubmenuTrigger className={popupItem}>
            <Users />
            Switch workspace
            <ChevronRight className="ml-auto" />
          </BaseMenu.SubmenuTrigger>
          <BaseMenu.Portal>
            <BaseMenu.Positioner className="z-50" sideOffset={4} alignOffset={-4}>
              <BaseMenu.Popup className={cn(popupSurface, "w-56")}>
                <MenuLabel>Workspaces</MenuLabel>
                {workspaces.map((w) => (
                  <MenuItem key={w.id} onClick={() => w.id !== workspace.id && switchWorkspace(w.id)}>
                    <Avatar name={w.name} seed={w.id} size="sm" variant="solid" />
                    <span className="truncate">{w.name}</span>
                    {w.id === workspace.id ? <Check className="ml-auto !text-accent-fg" /> : null}
                  </MenuItem>
                ))}
                {demo ? null : (
                  <>
                    <MenuSeparator />
                    <MenuItem onClick={() => router.push("/onboarding?new=1")}>
                      <Plus />
                      Create workspace
                    </MenuItem>
                  </>
                )}
              </BaseMenu.Popup>
            </BaseMenu.Positioner>
          </BaseMenu.Portal>
        </BaseMenu.SubmenuRoot>
      </RailMenu>

      <div className="my-1.5 h-px w-7 bg-border-strong/70" />

      <nav aria-label="Apps" className="flex min-h-0 flex-col items-center gap-1.5 overflow-y-auto scrollbar-thin">
        {apps?.map((app) => (
          <RailLink key={app.id} href={`/apps/${app.id}`} label={app.name} active={app.id === appId}>
            <Avatar name={app.name} seed={app.id} size="lg" variant="solid" />
          </RailLink>
        ))}
        <RailLink href="/apps?new=1" label="New app">
          <Plus className="!size-[18px]" />
        </RailLink>
      </nav>

      <div className="mt-auto flex flex-col items-center gap-1.5">
        <Tooltip content={theme.resolved === "dark" ? "Light mode" : "Dark mode"} side="right">
          <button
            type="button"
            aria-label={theme.resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={theme.toggle}
            className={tile}
          >
            {theme.resolved === "dark" ? <Sun /> : <Moon />}
          </button>
        </Tooltip>
        <RailLink href="/settings/workspace" label="Settings" active={pathname.startsWith("/settings")}>
          <Settings />
        </RailLink>
        <RailMenu label={user.name} trigger={
            // Neutral chip so the user reads apart from the purple app icons.
            <Avatar
              name={user.name}
              seed={user.id}
              size="lg"
              shape="circle"
              className="bg-bg text-fg shadow-xs ring-1 ring-inset ring-border-strong"
            />
          }>
          <div className="px-2 py-1.5">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-fg-tertiary">{user.email}</div>
          </div>
          <MenuSeparator />
          <MenuItem onClick={() => router.push("/settings/profile")}>
            <User />
            Profile
          </MenuItem>
          <MenuItem onClick={() => router.push("/settings/workspace")}>
            <Settings />
            Workspace settings
          </MenuItem>
          <BaseMenu.SubmenuRoot>
            <BaseMenu.SubmenuTrigger className={popupItem}>
              <Palette />
              Theme
              <ChevronRight className="ml-auto" />
            </BaseMenu.SubmenuTrigger>
            <BaseMenu.Portal>
              <BaseMenu.Positioner className="z-50" sideOffset={4} alignOffset={-4}>
                <BaseMenu.Popup className={cn(popupSurface, "w-44")}>
                  {THEME_OPTIONS.map((o) => (
                    <MenuItem key={o.value} onClick={() => theme.setTheme(o.value)}>
                      {o.icon}
                      {o.label}
                      {theme.preference === o.value ? <Check className="ml-auto !text-accent-fg" /> : null}
                    </MenuItem>
                  ))}
                </BaseMenu.Popup>
              </BaseMenu.Positioner>
            </BaseMenu.Portal>
          </BaseMenu.SubmenuRoot>
          <MenuSeparator />
          <MenuItem onClick={signOut}>
            <LogOut />
            Sign out
          </MenuItem>
        </RailMenu>
      </div>
    </div>
  );
}
