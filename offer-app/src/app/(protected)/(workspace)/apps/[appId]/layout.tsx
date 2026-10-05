import { AppShell } from "@/components/shell/shells";
import { AppGate } from "./app-gate";

export default async function AppLayout({ children, params }: LayoutProps<"/apps/[appId]">) {
  const { appId } = await params;
  return (
    <AppShell appId={decodeURIComponent(appId)}>
      <AppGate appId={decodeURIComponent(appId)}>{children}</AppGate>
    </AppShell>
  );
}
