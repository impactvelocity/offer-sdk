import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSdkSkill, sdkFilesFor, type SdkFile, type SdkSkillInput } from "@/components/developers/sdk-skill";
import { readSdkFiles } from "@/server/sdk-source";

const SELECTIONS = [
  { checkout: false, cancel: false },
  { checkout: true, cancel: false },
  { checkout: false, cancel: true },
  { checkout: true, cancel: true },
];

async function input(): Promise<SdkSkillInput> {
  const files = await readSdkFiles();
  if (!files) throw new Error("src/sdk not found");
  return {
    baseUrl: "https://api.example.com",
    appId: "app_123",
    appName: 'Acme "Pro": Studio',
    publicKey: "pub_test_123",
    files,
    examples: { flag: "export_pdf", usageEntitlement: "ai_credits" },
  };
}

/** Relative imports in `file` that don't resolve to a file in `files`. */
function missingImports(file: SdkFile, files: SdkFile[]) {
  const paths = new Set(files.map((f) => f.path));
  const dir = path.posix.dirname(file.path);
  return [...file.code.matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)]
    .map(([, spec]) => path.posix.normalize(path.posix.join(dir, spec)))
    .filter((target) => ![".ts", ".tsx", "/index.ts"].some((ext) => paths.has(`${target}${ext}`)));
}

describe("sdk skill", () => {
  it("reads the SDK's entry points", async () => {
    const paths = (await input()).files.map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(["index.ts", "checkout/index.ts", "cancel/index.ts"]));
  });

  it("carries every file each module selection imports", async () => {
    const { files } = await input();
    for (const selection of SELECTIONS) {
      const included = sdkFilesFor(files, selection);
      for (const file of included) expect(missingImports(file, included), file.path).toEqual([]);
    }
  });

  it("embeds each included file verbatim, and only those", async () => {
    const data = await input();
    for (const selection of SELECTIONS) {
      const skill = buildSdkSkill(data, { ...selection, publicKey: false });
      const included = new Set(sdkFilesFor(data.files, selection).map((f) => f.path));
      for (const file of data.files) {
        expect(skill.includes(`### \`${file.path}\``), file.path).toBe(included.has(file.path));
        if (included.has(file.path)) expect(skill).toContain(file.code.replace(/\n$/, ""));
      }
    }
  });

  it("includes the publishable key only when asked", async () => {
    const data = await input();
    expect(buildSdkSkill(data, { checkout: true, cancel: true, publicKey: false })).not.toContain(data.publicKey);
    expect(buildSdkSkill(data, { checkout: true, cancel: true, publicKey: true })).toContain(data.publicKey);
  });

  it("starts with valid frontmatter", async () => {
    const skill = buildSdkSkill(await input(), { checkout: true, cancel: true, publicKey: false });
    const [, frontmatter] = skill.split("---\n");
    const [name, description] = frontmatter.trim().split("\n");
    expect(name).toBe("name: offer-sdk");
    expect(JSON.parse(description.replace(/^description: /, ""))).toContain('Acme "Pro": Studio');
  });
});
