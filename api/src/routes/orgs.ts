import { Hono } from "hono";
import sql from "../db/client.ts";
import { omit, readJson, readObject } from "../lib/http.ts";

const orgs = new Hono();

const notFound = { error: "Org not found" };

// GET /orgs
orgs.get("/", async (c) => {
  const rows = await sql`select data from orgs order by created_at, id`;
  return c.json(rows.map((r: { data: unknown }) => r.data));
});

// GET /orgs/:orgId
orgs.get("/:orgId", async (c) => {
  const [row] = await sql`select data from orgs where id = ${c.req.param("orgId")}`;
  if (!row) return c.json(notFound, 404);
  return c.json(row.data);
});

// POST /orgs  body: { id, app_ids? }
orgs.post("/", async (c) => {
  const { id, app_ids = [] } = (await readJson(c)) ?? {};
  if (typeof id !== "string" || !id) return c.json({ error: "id is required" }, 400);

  const org = { id, app_ids, created_at: new Date().toISOString() };

  const rows = await sql`
    insert into orgs (id, data) values (${id}, ${org}::jsonb)
    on conflict (id) do nothing
    returning id`;
  if (!rows.length) return c.json({ error: `Org with id "${id}" already exists` }, 409);

  return c.json(org, 201);
});

// PATCH /orgs/:orgId  body: { app_ids? }
orgs.patch("/:orgId", async (c) => {
  const payload = omit(await readObject(c), ["id", "created_at"]);
  const [row] = await sql`
    update orgs set data = data || ${payload}::jsonb
    where id = ${c.req.param("orgId")}
    returning data`;
  if (!row) return c.json(notFound, 404);
  return c.json(row.data);
});

// GET /orgs/:orgId/apps
orgs.get("/:orgId/apps", async (c) => {
  const [org] = await sql`select data from orgs where id = ${c.req.param("orgId")}`;
  if (!org) return c.json(notFound, 404);

  // Keeps the org's app_ids order and skips ids whose app no longer exists.
  const rows = await sql`
    select a.data
    from jsonb_array_elements_text(coalesce(${org.data}::jsonb -> 'app_ids', '[]')) with ordinality as ids(id, n)
    join apps a on a.id = ids.id
    order by ids.n`;
  return c.json(rows.map((r: { data: unknown }) => r.data));
});

// DELETE /orgs/:orgId
orgs.delete("/:orgId", async (c) => {
  const rows = await sql`delete from orgs where id = ${c.req.param("orgId")} returning id`;
  if (!rows.length) return c.json(notFound, 404);
  return c.json({ deleted: true });
});

export default orgs;
