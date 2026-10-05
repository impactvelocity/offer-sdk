import { WorkspaceShell } from "@/components/shell/shells";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
