import { Hono } from "hono";
import { changeDoc, deleteDoc, getDoc, insertDoc, listDocs } from "../db/docs.ts";
import { searchNamespaces } from "../db/search.ts";
import { attachmentRoutes } from "../lib/attachments.ts";
import { type Json, omit, pagination, readJson, readObject } from "../lib/http.ts";
import { slugify } from "../lib/slugify.ts";
import { emit, emitUpdated } from "../lib/webhooks.ts";

const plans = new Hono();

const notFound = { error: "Plan not found" };

const pricingCard = (plan: Json) => ({
  plan_id: plan.id,
  isFree: plan.isFree ?? false,
  ...(plan.pricingCard ?? {}),
});

// GET /apps/:appId/plans
plans.get("/", async (c) => {
  return c.json(await listDocs("plans", c.req.param("appId")!));
});

// GET /apps/:appId/plans/pricing
plans.get("/pricing", async (c) => {
  const all = await listDocs("plans", c.req.param("appId")!);
  return c.json(all.filter((p) => p.pricingCard).map(pricingCard));
});

// GET /apps/:appId/plans/:planId
plans.get("/:planId", async (c) => {
  const doc = await getDoc("plans", c.req.param("appId")!, c.req.param("planId"));
  if (!doc) return c.json(notFound, 404);
  return c.json(doc);
});

// POST /apps/:appId/plans
plans.post("/", async (c) => {
  const appId = c.req.param("appId")!;
  const { id: rawId, name, description, note, pricingCard, isFree } = (await readJson(c)) ?? {};
  if (typeof rawId !== "string") return c.json({ error: "id is required" }, 400);
  const id = slugify(rawId);

  const plan = {
    id,
    app_id: appId,
    name,
    description,
    note: note ?? null,
    isFree: isFree ?? false,
    pricingCard: pricingCard ?? null,
    addons: [],
    entitlements: [],
    meta: {},
    created_at: new Date().toISOString(),
  };

  if (!(await insertDoc("plans", appId, id, plan))) {
    return c.json({ error: `Plan with id "${id}" already exists` }, 409);
  }

  await emit(appId, "plan.created", { object: plan });
  return c.json(plan, 201);
});

// GET /apps/:appId/plans/:planId/pricing
plans.get("/:planId/pricing", async (c) => {
  const doc = await getDoc("plans", c.req.param("appId")!, c.req.param("planId"));
  if (!doc) return c.json(notFound, 404);
  if (!doc.pricingCard) return c.json({ error: "No pricing card set" }, 404);
  return c.json(pricingCard(doc));
});

// GET /apps/:appId/plans/:planId/namespaces?page=1&per_page=20
plans.get("/:planId/namespaces", async (c) => {
  const { page, perPage } = pagination(c);
  const result = await searchNamespaces({
    appId: c.req.param("appId")!,
    plan: c.req.param("planId"),
    page,
    perPage,
  });
  return c.json({
    data: result.hits.map((d) => ({ id: d.namespace_id, name: d.name })),
    total: result.found,
    page,
    per_page: perPage,
  });
});

// PATCH /apps/:appId/plans/:planId
plans.patch("/:planId", async (c) => {
  const appId = c.req.param("appId")!;
  const payload = omit(await readObject(c), ["id", "app_id"]);
  const change = await changeDoc("plans", appId, c.req.param("planId"), (plan) => ({ ...plan, ...payload }));
  if (!change) return c.json(notFound, 404);
  await emitUpdated(appId, "plan.updated", change.before, change.after);
  return c.json(change.after);
});

// PATCH /apps/:appId/plans/:planId/meta
plans.patch("/:planId/meta", async (c) => {
  const appId = c.req.param("appId")!;
  const payload = await readObject(c);
  const change = await changeDoc("plans", appId, c.req.param("planId"), (plan) => ({
    ...plan,
    meta: { ...(plan.meta ?? {}), ...payload },
  }));
  if (!change) return c.json(notFound, 404);
  await emitUpdated(appId, "plan.updated", change.before, change.after);
  return c.json(change.after);
});

// DELETE /apps/:appId/plans/:planId
plans.delete("/:planId", async (c) => {
  const appId = c.req.param("appId")!;
  const deleted = await deleteDoc("plans", appId, c.req.param("planId"));
  if (!deleted) return c.json(notFound, 404);
  await emit(appId, "plan.deleted", { object: deleted });
  return c.json({ deleted: true });
});

attachmentRoutes(plans, { table: "plans", param: "planId", label: "Plan" });

export default plans;
