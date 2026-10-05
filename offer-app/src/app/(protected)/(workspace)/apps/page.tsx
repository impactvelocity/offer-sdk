import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/shell/shells";
import { AppsView } from "./apps-view";

export const metadata: Metadata = { title: "Apps" };

export default function AppsPage() {
  return (
    <WorkspaceShell>
      <AppsView />
    </WorkspaceShell>
  );
}
