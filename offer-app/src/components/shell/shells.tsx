"use client";

import type { ReactNode } from "react";
import { AppNav } from "./app-nav";
import { CommandMenuProvider } from "./command-menu";
import { ShellLayout } from "./mobile-nav";
import { AppRail } from "./rail";
import { WorkspaceNav } from "./workspace-nav";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <CommandMenuProvider>
      <ShellLayout rail={<AppRail />} panel={<WorkspaceNav />}>
        {children}
      </ShellLayout>
    </CommandMenuProvider>
  );
}

export function AppShell({ appId, children }: { appId: string; children: ReactNode }) {
  return (
    <CommandMenuProvider appId={appId}>
      <ShellLayout rail={<AppRail appId={appId} />} panel={<AppNav appId={appId} />}>
        {children}
      </ShellLayout>
    </CommandMenuProvider>
  );
}
