import { Hono } from "hono";
import sql from "../db/client.ts";
import { adminAuth } from "../lib/auth.ts";
import { type Json, limitParam, readObject } from "../lib/http.ts";

// Dashboard agent chat threads. Admin key only: the dashboard stores them per signed-in
// user and checks `user_id` itself; app keys never see them. Not part of the public API.

const threads = new Hono();

threads.use("*", adminAuth);

const notFound = { error: "Thread not found" };
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_TITLE = 120;

// Validates a PUT body; returns the clean fields or an error.
function putFields(body: Json): { user_id: string; messages: unknown[]; title: string | null } | { error: string } {
  if (typeof body.user_id !== "string" || !body.user_id) return { error: "user_id is required" };
  if (!Array.isArray(body.messages)) return { error: "messages must be an array" };
  if ("title" in body && typeof body.title !== "string") return { error: "title must be a string" };
  const title = typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE) : null;
  return { user_id: body.user_id, messages: body.messages, title };
}

// GET /apps/:appId/agent/threads?user_id=&limit=50
// Newest activity first, without messages.
threads.get("/", async (c) => {
  const userId = c.req.query("user_id");
  if (!userId) return c.json({ error: "user_id is required" }, 400);
  const rows = await sql`
    select app_id, id, user_id, title, jsonb_array_length(messages)::int as message_count, created_at, updated_at from agent_threads
    where app_id = ${c.req.param("appId")!} and user_id = ${userId}
    order by updated_at desc
    limit ${limitParam(c, 50)}`;
  return c.json(rows);
});

// GET /apps/:appId/agent/threads/:threadId
threads.get("/:threadId", async (c) => {
  const [row] = await sql`
    select app_id, id, user_id, title, messages, created_at, updated_at from agent_threads
    where app_id = ${c.req.param("appId")!} and id = ${c.req.param("threadId")}`;
  return row ? c.json(row) : c.json(notFound, 404);
});

// PUT /apps/:appId/agent/threads/:threadId  body: { user_id, messages, title? }
// Creates the thread or replaces its messages. A thread never changes owner.
threads.put("/:threadId", async (c) => {
  const id = c.req.param("threadId");
  if (!ID.test(id)) return c.json({ error: "Invalid thread id" }, 400);
  const f = putFields(await readObject(c));
  if ("error" in f) return c.json(f, 400);

  const [row] = await sql`
    insert into agent_threads (app_id, id, user_id, title, messages)
    values (${c.req.param("appId")!}, ${id}, ${f.user_id}, ${f.title ?? ""}, ${f.messages}::jsonb)
    on conflict (app_id, id) do update set
      messages = excluded.messages,
      title = coalesce(${f.title}::text, agent_threads.title),
      updated_at = now()
    where agent_threads.user_id = excluded.user_id
    returning app_id, id, user_id, title, jsonb_array_length(messages)::int as message_count, created_at, updated_at`;
  if (!row) return c.json({ error: "Thread belongs to another user" }, 409);
  return c.json(row);
});

// PATCH /apps/:appId/agent/threads/:threadId  body: { title }
// Renaming doesn't count as activity, so the thread keeps its place in the list.
threads.patch("/:threadId", async (c) => {
  const body = await readObject(c);
  if (typeof body.title !== "string") return c.json({ error: "title is required" }, 400);
  const [row] = await sql`
    update agent_threads set title = ${body.title.trim().slice(0, MAX_TITLE)}
    where app_id = ${c.req.param("appId")!} and id = ${c.req.param("threadId")}
    returning app_id, id, user_id, title, jsonb_array_length(messages)::int as message_count, created_at, updated_at`;
  return row ? c.json(row) : c.json(notFound, 404);
});

// DELETE /apps/:appId/agent/threads/:threadId
threads.delete("/:threadId", async (c) => {
  const rows = await sql`
    delete from agent_threads
    where app_id = ${c.req.param("appId")!} and id = ${c.req.param("threadId")}
    returning id`;
  return rows.length ? c.json({ deleted: true }) : c.json(notFound, 404);
});

export default threads;
