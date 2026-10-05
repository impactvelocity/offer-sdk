import { Hono } from "hono";
import { changeDoc, getDoc } from "../db/docs.ts";
import { readObject } from "../lib/http.ts";
import { emit, emitAccountChanges } from "../lib/webhooks.ts";

// /apps/:appId/namespaces/:namespaceId/addons
// Add-ons an account owns itself (bought as an order bump, or given by hand),
// on top of the ones its plan and incentive include.
const accountAddons = new Hono();

// POST /apps/:appId/namespaces/:namespaceId/addons
// Body: { id }
accountAddons.post("/", async (c) => {
  const appId = c.req.param("appId")!;
  const namespaceId = c.req.param("namespaceId")!;
  const { id } = await readObject(c);
  if (typeof id !== "string") return c.json({ error: "id is required" }, 400);
  if (!(await getDoc("addons", appId, id))) return c.json({ error: `Addon "${id}" not found` }, 404);

  const change = await changeDoc("namespaces", appId, namespaceId, (doc) => ({
    ...doc,
    addons: [...new Set([...(doc.addons ?? []), id])],
  }));
  if (!change) return c.json({ error: "Namespace not found" }, 404);

  if (!(change.before.addons ?? []).includes(id)) {
    await emitAccountChanges(appId, change.before, change.after);
    await emit(appId, "account.addon_granted", { object: change.after, addon_id: id, source: "manual" });
  }
  return c.json(change.after);
});

// DELETE /apps/:appId/namespaces/:namespaceId/addons/:addonId
accountAddons.delete("/:addonId", async (c) => {
  const appId = c.req.param("appId")!;
  const addonId = c.req.param("addonId");
  const change = await changeDoc("namespaces", appId, c.req.param("namespaceId")!, (doc) => ({
    ...doc,
    addons: (doc.addons ?? []).filter((a: string) => a !== addonId),
  }));
  if (!change) return c.json({ error: "Namespace not found" }, 404);
  await emitAccountChanges(appId, change.before, change.after);
  return c.json(change.after);
});

export default accountAddons;
