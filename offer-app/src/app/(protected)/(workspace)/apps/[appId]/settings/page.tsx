import type { Metadata } from "next";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "App Settings" };

export default function AppSettingsPage() {
  return <SettingsView />;
}
