import type { Metadata } from "next";
import { McpView } from "./mcp-view";

export const metadata: Metadata = { title: "MCP server" };

export default function McpPage() {
  return <McpView />;
}
