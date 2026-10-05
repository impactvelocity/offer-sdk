import { readdir } from "node:fs/promises";
import { join } from "node:path";
import sql from "./client.ts";

const MIGRATIONS_DIR = join(import.meta.dir, "../../migrations");
const LOCK_ID = 727_001; // arbitrary, shared by every instance

// Applies pending migrations/*.sql in filename order. Safe to run from several
// instances at once: the advisory lock serialises them.
export async function migrate() {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${LOCK_ID})`;
    await tx`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )`;

    const applied = new Set(
      (await tx`select name from schema_migrations`).map((r: { name: string }) => r.name),
    );

    for (const file of files) {
      if (applied.has(file)) continue;
      await tx.unsafe(await Bun.file(join(MIGRATIONS_DIR, file)).text());
      await tx`insert into schema_migrations (name) values (${file})`;
      console.log(`migrated ${file}`);
    }
  });
}

if (import.meta.main) {
  await migrate();
  await sql.close();
}
