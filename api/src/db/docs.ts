import sql from "./client.ts";
import type { Json } from "../lib/http.ts";

// Per-app resources share one shape: (app_id, id, data jsonb, created_at).
// Table names come from this union only, never from user input.
export type DocTable = "plans" | "entitlements" | "addons" | "incentives" | "namespaces" | "analytics_reports" | "offers";

export async function listDocs(table: DocTable, appId: string): Promise<Json[]> {
  const rows = await sql.unsafe(
    `select data from ${table} where app_id = $1 order by created_at, id`,
    [appId],
  );
  return rows.map((r: { data: Json }) => r.data);
}

export async function getDoc(table: DocTable, appId: string, id: string): Promise<Json | null> {
  const [row] = await sql.unsafe(`select data from ${table} where app_id = $1 and id = $2`, [
    appId,
    id,
  ]);
  return row?.data ?? null;
}

export async function getDocs(table: DocTable, appId: string, ids: string[]): Promise<Map<string, Json>> {
  if (!ids.length) return new Map();
  const rows = await sql.unsafe(
    `select id, data from ${table}
     where app_id = $1 and id in (select jsonb_array_elements_text($2::jsonb))`,
    [appId, ids],
  );
  return new Map(rows.map((r: { id: string; data: Json }) => [r.id, r.data]));
}

// Returns false when a doc with this id already exists.
export async function insertDoc(table: DocTable, appId: string, id: string, data: Json): Promise<boolean> {
  const rows = await sql.unsafe(
    `insert into ${table} (app_id, id, data) values ($1, $2, $3::jsonb)
     on conflict (app_id, id) do nothing returning id`,
    [appId, id, data],
  );
  return rows.length > 0;
}

// Shallow merge, same as the legacy `{ ...current, ...payload }`.
export async function mergeDoc(table: DocTable, appId: string, id: string, patch: Json): Promise<Json | null> {
  const [row] = await sql.unsafe(
    `update ${table} set data = data || $3::jsonb where app_id = $1 and id = $2 returning data`,
    [appId, id, patch],
  );
  return row?.data ?? null;
}

// Returns the deleted document, or null when there was none.
export async function deleteDoc(table: DocTable, appId: string, id: string): Promise<Json | null> {
  const [row] = await sql.unsafe(`delete from ${table} where app_id = $1 and id = $2 returning data`, [appId, id]);
  return row?.data ?? null;
}

// Read-modify-write under a row lock, for edits to nested arrays. `fn` returns
// the new document, or throws an ApiError to abort without writing.
export async function updateDoc(
  table: DocTable,
  appId: string,
  id: string,
  fn: (doc: Json) => Json | Promise<Json>,
): Promise<Json | null> {
  return (await changeDoc(table, appId, id, fn))?.after ?? null;
}

// Same as updateDoc, but also returns the document as it was before, so
// callers can diff the change (webhook `previous` values).
export async function changeDoc(
  table: DocTable,
  appId: string,
  id: string,
  fn: (doc: Json) => Json | Promise<Json>,
): Promise<{ before: Json; after: Json } | null> {
  return sql.begin(async (tx) => {
    const [row] = await tx.unsafe(
      `select data from ${table} where app_id = $1 and id = $2 for update`,
      [appId, id],
    );
    if (!row) return null;
    const next = await fn(row.data);
    const [updated] = await tx.unsafe(
      `update ${table} set data = $3::jsonb where app_id = $1 and id = $2 returning data`,
      [appId, id, next],
    );
    return { before: row.data, after: updated.data };
  });
}
