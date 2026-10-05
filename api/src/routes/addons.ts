import { Hono } from "hono";
import { deleteDoc, getDoc, insertDoc, listDocs, mergeDoc } from "../db/docs.ts";
import { omit, readJson, readObject } from "../lib/http.ts";
import { slugify } from "../lib/slugify.ts";

const addons = new Hono();

const notFound = { error: "Addon not found" };

// GET /apps/:appId/addons
addons.get("/", async (c) => {
  return c.json(await listDocs("addons", c.req.param("appId")!));
});

// GET /apps/:appId/addons/:addonId
addons.get("/:addonId", async (c) => {
  const doc = await getDoc("addons", c.req.param("appId")!, c.req.param("addonId"));
  if (!doc) return c.json(notFound, 404);
  return c.json(doc);
});

// POST /apps/:appId/addons
addons.post("/", async (c) => {
  const appId = c.req.param("appId")!;
  const { id: rawId, name, description } = (await readJson(c)) ?? {};
  if (typeof rawId !== "string") return c.json({ error: "id is required" }, 400);
  const id = slugify(rawId);

  const addon = {
    id,
    app_id: appId,
    name,
    description,
    created_at: new Date().toISOString(),
  };

  if (!(await insertDoc("addons", appId, id, addon))) {
    return c.json({ error: `Addon with id "${id}" already exists` }, 409);
  }

  return c.json(addon, 201);
});

// PATCH /apps/:appId/addons/:addonId
addons.patch("/:addonId", async (c) => {
  const payload = omit(await readObject(c), ["id", "app_id"]);
  const doc = await mergeDoc("addons", c.req.param("appId")!, c.req.param("addonId"), payload);
  if (!doc) return c.json(notFound, 404);
  return c.json(doc);
});

// DELETE /apps/:appId/addons/:addonId
addons.delete("/:addonId", async (c) => {
  const deleted = await deleteDoc("addons", c.req.param("appId")!, c.req.param("addonId"));
  if (!deleted) return c.json(notFound, 404);
  return c.json({ deleted: true });
});

export default addons;
