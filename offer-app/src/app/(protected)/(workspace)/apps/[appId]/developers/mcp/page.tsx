import type { Metadata } from "next";
import { McpView } from "./mcp-view";

export const metadata: Metadata = { title: "MCP Server" };

export default function McpPage() {
  return <McpView />;
}
