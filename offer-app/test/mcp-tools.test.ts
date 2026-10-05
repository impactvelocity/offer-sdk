import { describe, expect, it } from "vitest";
import { ENDPOINTS } from "@/components/developers/endpoints";
import { EXCLUDED_ENDPOINTS, MCP_TOOLS, UNMAPPED_ROUTES } from "@/components/developers/mcp-tools";

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
});
