import "server-only";
import Database from "better-sqlite3";
import { Kysely, PostgresDialect, SqliteDialect, type Generated } from "kysely";
import { Pool } from "pg";

// One database for everything: better-auth's tables plus the blog's own.
// SQLite by default (./blog.sqlite3); Postgres when DATABASE_URL is set.

export interface PostsTable {
  id: Generated<number>;
  user_id: string;
  title: string;
  body: string;
  pinned: number;
  created_at: string;
  updated_at: string;
}

export interface CommentsTable {
  id: Generated<number>;
  post_id: number;
  commenter: string;
  body: string;
  created_at: string;
}

export interface SettingsTable {
  key: string;
  value: string;
}

export interface WebhookEventsTable {
  id: string;
  type: string;
  payload: string;
  verified: number;
  received_at: string;
}

/** better-auth's table, read-only here (for author names). */
export interface UserTable {
  id: string;
  name: string;
  email: string;
}

export interface DB {
  user: UserTable;
  posts: PostsTable;
  comments: CommentsTable;
  offer_settings: SettingsTable;
  webhook_events: WebhookEventsTable;
}

export const dialect: "postgres" | "sqlite" = process.env.DATABASE_URL ? "postgres" : "sqlite";

function connect(): Kysely<DB> {
  if (dialect === "postgres") {
    return new Kysely<DB>({ dialect: new PostgresDialect({ pool: new Pool({ connectionString: process.env.DATABASE_URL }) }) });
  }
  return new Kysely<DB>({ dialect: new SqliteDialect({ database: new Database(process.env.SQLITE_PATH ?? "blog.sqlite3") }) });
}

// Survives dev hot reloads, like ActiveRecord's connection pool.
const globalForDb = globalThis as unknown as { blogDb?: Kysely<DB> };
export const db = (globalForDb.blogDb ??= connect());

export const now = () => new Date().toISOString();
