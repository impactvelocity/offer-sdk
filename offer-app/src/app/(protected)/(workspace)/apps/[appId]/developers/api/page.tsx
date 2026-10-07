import type { Metadata } from "next";
import { ApiReferenceView } from "./api-reference-view";

export const metadata: Metadata = { title: "API Reference" };

export default function ApiReferencePage() {
  return <ApiReferenceView />;
}
