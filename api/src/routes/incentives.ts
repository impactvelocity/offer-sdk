import { Hono } from "hono";
import { changeDoc, deleteDoc, getDoc, insertDoc, listDocs } from "../db/docs.ts";
import { attachmentRoutes } from "../lib/attachments.ts";
import { omit, readJson, readObject } from "../lib/http.ts";
import { slugify } from "../lib/slugify.ts";
import { emit, emitUpdated } from "../lib/webhooks.ts";

const incentives = new Hono();

const notFound = { error: "Incentive not found" };

// GET /apps/:appId/incentives
incentives.get("/", async (c) => {
  return c.json(await listDocs("incentives", c.req.param("appId")!));
});

// GET /apps/:appId/incentives/:incentiveId
incentives.get("/:incentiveId", async (c) => {
  const doc = await getDoc("incentives", c.req.param("appId")!, c.req.param("incentiveId"));
  if (!doc) return c.json(notFound, 404);
  return c.json(doc);
});

// POST /apps/:appId/incentives
incentives.post("/", async (c) => {
  const appId = c.req.param("appId")!;
  const { id: rawId, name, description, entitlements = [], addons = [] } = (await readJson(c)) ?? {};
  if (typeof rawId !== "string") return c.json({ error: "id is required" }, 400);
  const id = slugify(rawId);

  const incentive = {
    id,
    app_id: appId,
    name,
    description,
    entitlements,
    addons,
    created_at: new Date().toISOString(),
  };

  if (!(await insertDoc("incentives", appId, id, incentive))) {
    return c.json({ error: `Incentive with id "${id}" already exists` }, 409);
  }

  await emit(appId, "incentive.created", { object: incentive });
  return c.json(incentive, 201);
});

// PATCH /apps/:appId/incentives/:incentiveId
incentives.patch("/:incentiveId", async (c) => {
  const appId = c.req.param("appId")!;
  const payload = omit(await readObject(c), ["id", "app_id"]);
  const change = await changeDoc("incentives", appId, c.req.param("incentiveId"), (doc) => ({ ...doc, ...payload }));
  if (!change) return c.json(notFound, 404);
  await emitUpdated(appId, "incentive.updated", change.before, change.after);
  return c.json(change.after);
});

// DELETE /apps/:appId/incentives/:incentiveId
incentives.delete("/:incentiveId", async (c) => {
  const appId = c.req.param("appId")!;
  const deleted = await deleteDoc("incentives", appId, c.req.param("incentiveId"));
  if (!deleted) return c.json(notFound, 404);
  await emit(appId, "incentive.deleted", { object: deleted });
  return c.json({ deleted: true });
});

attachmentRoutes(incentives, { table: "incentives", param: "incentiveId", label: "Incentive" });

export default incentives;
