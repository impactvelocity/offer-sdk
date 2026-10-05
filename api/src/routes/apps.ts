import { Hono } from "hono";
import sql from "../db/client.ts";
import { prefixedId } from "../lib/ids.ts";
import { omit, readJson, readObject } from "../lib/http.ts";

const apps = new Hono();

const notFound = { error: "App not found" };

// GET /apps/:appId
apps.get("/:appId", async (c) => {
  const [row] = await sql`select data from apps where id = ${c.req.param("appId")}`;
  if (!row) return c.json(notFound, 404);
  return c.json(row.data);
});

// POST /apps
apps.post("/", async (c) => {
  const { name, plan } = (await readJson(c)) ?? {};

  const app = {
    id: prefixedId("app", 6),
    name,
    plan,
    api_key: prefixedId("key", 32),
    public_key: prefixedId("pub", 32),
    created_at: new Date().toISOString(),
  };

  await sql`
    insert into apps (id, api_key, public_key, data)
    values (${app.id}, ${app.api_key}, ${app.public_key}, ${app}::jsonb)`;

  return c.json(app, 201);
});

// PATCH /apps/:appId
// Identity and key fields are ignored here; keys change via the regenerate routes.
apps.patch("/:appId", async (c) => {
  const payload = omit(await readObject(c), ["id", "api_key", "public_key", "created_at"]);
  const [row] = await sql`
    update apps set data = data || ${payload}::jsonb
    where id = ${c.req.param("appId")}
    returning data`;
  if (!row) return c.json(notFound, 404);
  return c.json(row.data);
});

// DELETE /apps/:appId
// Cascades to every plan, entitlement, addon, incentive, namespace and usage row.
apps.delete("/:appId", async (c) => {
  const rows = await sql`delete from apps where id = ${c.req.param("appId")} returning id`;
  if (!rows.length) return c.json(notFound, 404);
  return c.json({ deleted: true });
});

// POST /apps/:appId/keys/regenerate
apps.post("/:appId/keys/regenerate", async (c) => {
  const api_key = prefixedId("key", 32);
  const rows = await sql`
    update apps
    set api_key = ${api_key}, data = jsonb_set(data, '{api_key}', to_jsonb(${api_key}::text))
    where id = ${c.req.param("appId")}
    returning id`;
  if (!rows.length) return c.json(notFound, 404);
  return c.json({ api_key });
});

// POST /apps/:appId/public-key/regenerate
apps.post("/:appId/public-key/regenerate", async (c) => {
  const public_key = prefixedId("pub", 32);
  const rows = await sql`
    update apps
    set public_key = ${public_key}, data = jsonb_set(data, '{public_key}', to_jsonb(${public_key}::text))
    where id = ${c.req.param("appId")}
    returning id`;
  if (!rows.length) return c.json(notFound, 404);
  return c.json({ public_key });
});

export default apps;
