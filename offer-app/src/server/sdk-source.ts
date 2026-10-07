import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { SdkFile } from "@/components/developers/sdk-skill";

const SDK_DIR = path.join(process.cwd(), "src/sdk");

/**
 * The React SDK's source, for the install skill on the Integration page. The SDK isn't
 * published to npm, so the skill carries these files. Null when the source isn't on disk.
 */
export async function readSdkFiles(): Promise<SdkFile[] | null> {
  try {
    const entries = await readdir(SDK_DIR, { recursive: true, withFileTypes: true });
    const paths = entries
      .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
      .map((e) => path.relative(SDK_DIR, path.join(e.parentPath, e.name)).split(path.sep).join("/"))
      // Top-level files first, then each folder.
      .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
    return await Promise.all(paths.map(async (p) => ({ path: p, code: await readFile(path.join(SDK_DIR, p), "utf8") })));
  } catch {
    return null;
  }
}
