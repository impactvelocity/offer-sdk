import type { Metadata } from "next";
import { AddonsView } from "./addons-view";

export const metadata: Metadata = { title: "Add-ons" };

export default function AddonsPage() {
  return <AddonsView />;
}
