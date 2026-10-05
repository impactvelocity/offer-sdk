import type { Hono } from "hono";
import { changeDoc, getDoc } from "../db/docs.ts";
import { ApiError, type Json, readJson } from "./http.ts";
import { emitUpdated } from "./webhooks.ts";

type Owner = { table: "plans" | "incentives"; param: string; label: "Plan" | "Incentive" };

export type EntitlementRef = { id: string; max?: number | null };

// Registers the entitlement/addon attachment routes shared by plans and incentives:
//   POST   /:ownerId/entitlements                 body: { id, max? }
//   PATCH  /:ownerId/entitlements/:entitlementId  body: { max }
//   DELETE /:ownerId/entitlements/:entitlementId
//   POST   /:ownerId/addons                       body: { id }
//   DELETE /:ownerId/addons/:addonId
export function attachmentRoutes(router: Hono, { table, param, label }: Owner) {
  const notFound = { error: `${label} not found` };
  const on = `this ${label.toLowerCase()}`;
  const event = table === "plans" ? "plan.updated" : "incentive.updated";

  // Locked read-modify-write of the owner doc, then a plan/incentive.updated event.
  async function updateOwner(appId: string, ownerId: string, fn: (doc: Json) => Json) {
    const change = await changeDoc(table, appId, ownerId, fn);
    if (!change) return null;
    await emitUpdated(appId, event, change.before, change.after);
    return change.after;
  }

  router.post(`/:${param}/entitlements`, async (c) => {
    const appId = c.req.param("appId")!;
    const ownerId = c.req.param(param)!;

    if (!(await getDoc(table, appId, ownerId))) return c.json(notFound, 404);

    const { id, max } = (await readJson(c)) ?? {};

    const entitlement = await getDoc("entitlements", appId, id);
    if (!entitlement) return c.json({ error: `Entitlement "${id}" not found` }, 404);

    const entry = entitlement.type === "usage" ? { id, max: max ?? null } : { id };

    const updated = await updateOwner(appId, ownerId, (doc) => {
      const list: EntitlementRef[] = doc.entitlements ?? [];
      if (list.some((e) => e.id === id)) {
        throw new ApiError(409, `Entitlement "${id}" is already on ${on}`);
      }
      return { ...doc, entitlements: [...list, entry] };
    });
    if (!updated) return c.json(notFound, 404);
    return c.json(updated);
  });

  router.patch(`/:${param}/entitlements/:entitlementId`, async (c) => {
    const appId = c.req.param("appId")!;
    const ownerId = c.req.param(param)!;
    const entitlementId = c.req.param("entitlementId");

    const doc = await getDoc(table, appId, ownerId);
    if (!doc) return c.json(notFound, 404);
    if (!(doc.entitlements ?? []).some((e: EntitlementRef) => e.id === entitlementId)) {
      return c.json({ error: `Entitlement "${entitlementId}" not on ${on}` }, 404);
    }

    const { max } = (await readJson(c)) ?? {};

    const updated = await updateOwner(appId, ownerId, (doc) => ({
      ...doc,
      entitlements: (doc.entitlements ?? []).map((e: EntitlementRef) =>
        e.id === entitlementId ? { ...e, max } : e,
      ),
    }));
    if (!updated) return c.json(notFound, 404);
    return c.json(updated);
  });

  router.delete(`/:${param}/entitlements/:entitlementId`, async (c) => {
    const entitlementId = c.req.param("entitlementId");
    const updated = await updateOwner(c.req.param("appId")!, c.req.param(param)!, (doc) => ({
      ...doc,
      entitlements: (doc.entitlements ?? []).filter((e: EntitlementRef) => e.id !== entitlementId),
    }));
    if (!updated) return c.json(notFound, 404);
    return c.json(updated);
  });

  router.post(`/:${param}/addons`, async (c) => {
    const appId = c.req.param("appId")!;
    const ownerId = c.req.param(param)!;

    if (!(await getDoc(table, appId, ownerId))) return c.json(notFound, 404);

    const { id } = (await readJson(c)) ?? {};

    if (!(await getDoc("addons", appId, id))) return c.json({ error: `Addon "${id}" not found` }, 404);

    const updated = await updateOwner(appId, ownerId, (doc) => {
      const list: string[] = doc.addons ?? [];
      if (list.includes(id)) throw new ApiError(409, `Addon "${id}" is already on ${on}`);
      return { ...doc, addons: [...list, id] };
    });
    if (!updated) return c.json(notFound, 404);
    return c.json(updated);
  });

  router.delete(`/:${param}/addons/:addonId`, async (c) => {
    const addonId = c.req.param("addonId");
    const updated = await updateOwner(c.req.param("appId")!, c.req.param(param)!, (doc) => ({
      ...doc,
      addons: (doc.addons ?? []).filter((id: string) => id !== addonId),
    }));
    if (!updated) return c.json(notFound, 404);
    return c.json(updated);
  });
}
