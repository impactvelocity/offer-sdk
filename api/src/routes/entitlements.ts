import { Hono } from "hono";
import { deleteDoc, getDoc, insertDoc, listDocs, mergeDoc } from "../db/docs.ts";
import { omit, readJson, readObject } from "../lib/http.ts";
import { slugify } from "../lib/slugify.ts";

const entitlements = new Hono();

const notFound = { error: "Entitlement not found" };
const badType = { error: 'type must be "usage" or "boolean"' };

// GET /apps/:appId/entitlements
entitlements.get("/", async (c) => {
  return c.json(await listDocs("entitlements", c.req.param("appId")!));
});

// GET /apps/:appId/entitlements/:entitlementId
entitlements.get("/:entitlementId", async (c) => {
  const doc = await getDoc("entitlements", c.req.param("appId")!, c.req.param("entitlementId"));
  if (!doc) return c.json(notFound, 404);
  return c.json(doc);
});

// POST /apps/:appId/entitlements
entitlements.post("/", async (c) => {
  const appId = c.req.param("appId")!;
  const { id: rawId, type, name, description } = (await readJson(c)) ?? {};
  if (typeof rawId !== "string") return c.json({ error: "id is required" }, 400);
  const id = slugify(rawId);

  if (type !== "usage" && type !== "boolean") return c.json(badType, 400);

  const entitlement = {
    id,
    app_id: appId,
    type,
    name,
    description,
    created_at: new Date().toISOString(),
  };

  if (!(await insertDoc("entitlements", appId, id, entitlement))) {
    return c.json({ error: `Entitlement with id "${id}" already exists` }, 409);
  }

  return c.json(entitlement, 201);
});

// PATCH /apps/:appId/entitlements/:entitlementId
entitlements.patch("/:entitlementId", async (c) => {
  const payload = omit(await readObject(c), ["id", "app_id"]);

  if (payload.type && payload.type !== "usage" && payload.type !== "boolean") {
    return c.json(badType, 400);
  }
  // { mode: "allow" | "block", offer_id? }: "block" refuses usage past the
  // limit with a 402 and an upgrade offer.
  const { overage } = payload;
  if (
    overage !== undefined &&
    overage !== null &&
    (typeof overage !== "object" ||
      !["allow", "block"].includes(overage.mode) ||
      (overage.offer_id !== undefined && typeof overage.offer_id !== "string"))
  ) {
    return c.json({ error: 'overage must be { mode: "allow" | "block", offer_id? }' }, 400);
  }

  const doc = await mergeDoc("entitlements", c.req.param("appId")!, c.req.param("entitlementId"), payload);
  if (!doc) return c.json(notFound, 404);
  return c.json(doc);
});

// DELETE /apps/:appId/entitlements/:entitlementId
entitlements.delete("/:entitlementId", async (c) => {
  const deleted = await deleteDoc("entitlements", c.req.param("appId")!, c.req.param("entitlementId"));
  if (!deleted) return c.json(notFound, 404);
  return c.json({ deleted: true });
});

export default entitlements;
