import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ENDPOINTS } from "@/components/developers/endpoints";
import {
  EXCLUDED_ENDPOINTS,
  MCP_PROMPTS,
  MCP_RESOURCES,
  MCP_TOOLS,
  mcpToolManifest,
  UNMAPPED_ROUTES,
} from "@/components/developers/mcp-tools";
import { MCP_PROMPTS as SERVER_PROMPTS, MCP_RESOURCES as SERVER_RESOURCES } from "../../api/src/mcp/prompts";

// The API's MCP server reads its tools from this file. `pnpm mcp:tools` rewrites it.
const MANIFEST = path.resolve(import.meta.dirname, "../../api/src/mcp/tools.json");

describe("mcp tools", () => {
  it("cover every API endpoint, as a tool or a deliberate exclusion", () => {
    expect(UNMAPPED_ROUTES).toEqual([]);
    expect(MCP_TOOLS.length + EXCLUDED_ENDPOINTS.length).toBe(ENDPOINTS.length);
  });

  it("have unique snake_case names", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it("never take appId, and require every path param", () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.inputSchema.properties).not.toHaveProperty("appId");
      for (const [, param] of tool.endpoint.path.matchAll(/:(\w+)/g)) {
        if (param !== "appId") expect(tool.inputSchema.required).toContain(param);
      }
    }
  });

  it("match the API server's manifest (run `pnpm mcp:tools`)", async () => {
    const json = `${JSON.stringify(mcpToolManifest(), null, 2)}\n`;
    if (process.env.UPDATE_MCP_MANIFEST) await writeFile(MANIFEST, json);
    expect(await readFile(MANIFEST, "utf8")).toBe(json);
  });

  it("list the resources and prompts the server serves", () => {
    expect(MCP_RESOURCES.map((r) => [r.uri, r.name])).toEqual(SERVER_RESOURCES.map((r) => [r.uri, r.name]));
    expect(MCP_PROMPTS.map((p) => [p.name, p.arguments.map((a) => a.name)])).toEqual(
      SERVER_PROMPTS.map((p) => [p.name, p.arguments.map((a) => a.name)]),
    );
  });
});
