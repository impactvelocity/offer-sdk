import { getMigrations } from "better-auth/db/migration";
import { sql } from "kysely";
import { authOptions } from "@/lib/auth-options";
import { db, dialect } from "./index";

// `rake db:migrate`, run on boot from instrumentation.ts: better-auth's tables,
// then the blog's. Every step is idempotent.
export async function migrate() {
  const { runMigrations } = await getMigrations(authOptions);
  await runMigrations();

  const pk = dialect === "postgres" ? "serial" : "integer";
  const id = <T extends { primaryKey(): T; autoIncrement(): T }>(col: T) =>
    dialect === "postgres" ? col.primaryKey() : col.primaryKey().autoIncrement();

  await db.schema
    .createTable("posts")
    .ifNotExists()
    .addColumn("id", pk, id)
    .addColumn("user_id", "text", (c) => c.notNull())
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("body", "text", (c) => c.notNull())
    .addColumn("pinned", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("created_at", "text", (c) => c.notNull())
    .addColumn("updated_at", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("comments")
    .ifNotExists()
    .addColumn("id", pk, id)
    .addColumn("post_id", "integer", (c) => c.notNull().references("posts.id").onDelete("cascade"))
    .addColumn("commenter", "text", (c) => c.notNull())
    .addColumn("body", "text", (c) => c.notNull())
    .addColumn("created_at", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("offer_settings")
    .ifNotExists()
    .addColumn("key", "text", (c) => c.primaryKey())
    .addColumn("value", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("webhook_events")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("type", "text", (c) => c.notNull())
    .addColumn("payload", "text", (c) => c.notNull())
    .addColumn("verified", "integer", (c) => c.notNull())
    .addColumn("received_at", "text", (c) => c.notNull())
    .execute();

  if (dialect === "sqlite") await sql`pragma foreign_keys = on`.execute(db);
}
