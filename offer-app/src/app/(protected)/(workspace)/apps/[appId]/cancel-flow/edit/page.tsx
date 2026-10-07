import type { Metadata } from "next";
import { EditCancelFlow } from "./edit-cancel-flow";

export const metadata: Metadata = { title: "Edit cancel flow" };

export default function EditCancelFlowPage() {
  return <EditCancelFlow />;
}
