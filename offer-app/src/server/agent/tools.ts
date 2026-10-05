import { tool } from "ai";
import { z } from "zod";
import {
  applyAddonChanges,
  applyPricing,
  catalogLookup,
  entitlementRef,
  planPatch,
  type CatalogLookup,
} from "@/lib/agent/changes";
import * as input from "@/lib/agent/schemas";
import type { CatalogKind, ChangeResult } from "@/lib/agent/types";
import type { Addon, Entitlement, EntitlementRef, Incentive, Paginated, Plan } from "@/lib/api/types";
import { OfferApiError, offerApiFetch } from "@/server/offer-api";

// Tools the agent can call, scoped to one app. Each goes through the same gateway as the
// BFF (hosted API or mock), so answers match what the dashboard shows. Read tools run
// straight away; write tools (WRITE_TOOLS) only run after the user approves them in the
// chat (see toolApproval in the route). The API calls customer accounts "namespaces";
// the agent and UI call them accounts.

const enc = encodeURIComponent;

/** Upper bound on accounts the limit scan resolves in one call. */
const MAX_SCAN = 500;

const interval = z
  .enum(["7d", "30d", "60d", "6m", "year", "alltime"])
  .default("30d")
  .describe("Time window for usage numbers");

export function agentTools(appId: string) {
  const base = `/apps/${enc(appId)}`;

  async function call<T = unknown>(
    method: string,
    path: string,
    { query = {}, body }: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") params.set(k, String(v));
    const res = await offerApiFetch(method, `${base}${path}`, { query: params, body });
    const data = await res.json().catch(() => undefined);
    if (!res.ok) {
      const message = (data as { error?: string } | undefined)?.error;
      throw new OfferApiError(res.status, message ?? `${method} ${path} failed (${res.status})`);
    }
    return data as T;
  }

  const get = <T = unknown>(path: string, query: Record<string, string | number | undefined> = {}) =>
    call<T>("GET", path, { query });

  async function catalog() {
    const [plans, entitlements, addons, incentives] = await Promise.all([
      get<Plan[]>("/plans"),
      get<Entitlement[]>("/entitlements"),
      get<Addon[]>("/addons"),
      get<Incentive[]>("/incentives"),
    ]);
    return { plans, entitlements, addons, incentives, lookup: catalogLookup(entitlements, addons) };
  }

  /** Fails with a clear message when the model refers to entitlements or add-ons that don't exist. */
  function requireKnown(lookup: CatalogLookup, entitlementIds: string[] = [], addonIds: string[] = []) {
    const missingE = entitlementIds.filter((id) => !lookup.entitlements.has(id));
    const missingA = addonIds.filter((id) => !lookup.addons.has(id));
    if (missingE.length) throw new Error(`Unknown entitlement id(s): ${missingE.join(", ")}`);
    if (missingA.length) throw new Error(`Unknown add-on id(s): ${missingA.join(", ")}`);
  }

  async function getRecord<T>(kind: CatalogKind, id: string): Promise<T> {
    const path = { plan: "plans", entitlement: "entitlements", addon: "addons", incentive: "incentives" }[kind];
    try {
      return await get<T>(`/${path}/${enc(id)}`);
    } catch (e) {
      if (e instanceof OfferApiError && e.status === 404) throw new Error(`No ${kind} with id "${id}"`);
      throw e;
    }
  }

  /** Applies entitlement and add-on changes to a plan or incentive through the attachment routes. */
  async function applyAttachments(
    ownerPath: string,
    current: { entitlements: EntitlementRef[]; addons: string[] },
    changes: {
      setEntitlements?: input.EntitlementLimitInput[];
      removeEntitlements?: string[];
      addAddons?: string[];
      removeAddons?: string[];
    },
    lookup: CatalogLookup,
  ) {
    for (const id of changes.removeEntitlements ?? []) {
      if (current.entitlements.some((e) => e.id === id)) await call("DELETE", `${ownerPath}/entitlements/${enc(id)}`);
    }
    for (const change of changes.setEntitlements ?? []) {
      const ref = entitlementRef(change, lookup);
      const existing = current.entitlements.find((e) => e.id === change.id);
      if (!existing || changes.removeEntitlements?.includes(change.id)) {
        await call("POST", `${ownerPath}/entitlements`, { body: ref });
      } else if ("max" in ref && existing.max !== ref.max) {
        await call("PATCH", `${ownerPath}/entitlements/${enc(change.id)}`, { body: { max: ref.max } });
      }
    }
    for (const id of changes.removeAddons ?? []) {
      if (current.addons.includes(id)) await call("DELETE", `${ownerPath}/addons/${enc(id)}`);
    }
    for (const id of applyAddonChanges([], changes.addAddons)) {
      if (!current.addons.includes(id) || changes.removeAddons?.includes(id)) {
        await call("POST", `${ownerPath}/addons`, { body: { id } });
      }
    }
  }

  async function accountCount(planId: string) {
    return (await get<Paginated<unknown>>(`/plans/${enc(planId)}/namespaces`, { per_page: 1 })).total;
  }

  /** Ids of every account with this incentive (collected up front: the search index shrinks as we go). */
  async function accountsWithIncentive(incentiveId: string) {
    const ids: string[] = [];
    for (let page = 1; ; page++) {
      const res = await get<Paginated<{ id: string; namespace_id?: string }>>("/namespaces/with-incentive", {
        incentive: incentiveId,
        page,
        per_page: 100,
      });
      ids.push(...res.data.map((a) => a.namespace_id || a.id));
      if (res.data.length < 100 || ids.length >= res.total) break;
    }
    return ids;
  }

  const names = (records: { id: string; name: string }[]) => records.map((r) => r.name || r.id).join(", ");

  /** Removes an entitlement or add-on from every plan and incentive that has it (the API doesn't cascade). */
  async function detach(kind: "entitlements" | "addons", id: string) {
    const { plans, incentives } = await catalog();
    const has = (owner: Plan | Incentive) =>
      kind === "entitlements" ? owner.entitlements.some((e) => e.id === id) : owner.addons.includes(id);
    const fromPlans = plans.filter(has);
    const fromIncentives = incentives.filter(has);
    for (const p of fromPlans) await call("DELETE", `/plans/${enc(p.id)}/${kind}/${enc(id)}`);
    for (const i of fromIncentives) await call("DELETE", `/incentives/${enc(i.id)}/${kind}/${enc(id)}`);
    const impact: string[] = [];
    if (fromPlans.length) impact.push(`Removed from plans: ${names(fromPlans)}`);
    if (fromIncentives.length) impact.push(`Removed from incentives: ${names(fromIncentives)}`);
    return impact;
  }

  return {
    getAppOverview: tool({
      description: "The app's name plus how many plans, entitlements, add-ons, incentives and accounts it has.",
      inputSchema: z.object({}),
      execute: async () => {
        const [app, plans, entitlements, addons, incentives, accounts] = await Promise.all([
          get<{ id: string; name: string }>(""),
          get<unknown[]>("/plans"),
          get<unknown[]>("/entitlements"),
          get<unknown[]>("/addons"),
          get<unknown[]>("/incentives"),
          get<{ count: number }>("/namespaces/count"),
        ]);
        return {
          id: app.id,
          name: app.name,
          counts: {
            plans: plans.length,
            entitlements: entitlements.length,
            addons: addons.length,
            incentives: incentives.length,
            accounts: accounts.count,
          },
        };
      },
    }),

    getCatalog: tool({
      description:
        "List the app's plans (with pricing and the entitlements/limits each includes), entitlements (features and usage limits), add-ons or incentives.",
      inputSchema: z.object({ kind: z.enum(["plans", "entitlements", "addons", "incentives"]) }),
      execute: async ({ kind }) => get(`/${kind}`),
    }),

    searchAccounts: tool({
      description: "Search the app's customer accounts by name or id, optionally filtered by plan or incentive. 20 per page.",
      inputSchema: z.object({
        query: z.string().optional().describe("Name or id to search for; omit to list all"),
        plan: z.string().optional().describe("Plan id"),
        incentive: z.string().optional().describe("Incentive id"),
        page: z.number().int().min(1).default(1),
      }),
      execute: async ({ query, plan, incentive, page }) =>
        get("/namespaces", { q: query || "*", plan, incentive, page, per_page: 20 }),
    }),

    getAccount: tool({
      description:
        "One account's record plus its resolved plan: every entitlement it has access to, its limit after add-ons and incentives, and current usage.",
      inputSchema: z.object({ accountId: z.string() }),
      execute: async ({ accountId }) => {
        const [account, plan] = await Promise.all([
          get(`/namespaces/${enc(accountId)}`),
          get(`/namespaces/${enc(accountId)}/full-plan`),
        ]);
        return { account, plan };
      },
    }),

    findAccountsNearLimits: tool({
      description:
        "Accounts whose current usage is closest to (or over) their limits, as usage/limit per entitlement, highest first. Use this instead of opening accounts one by one.",
      inputSchema: z.object({
        minPercent: z.number().min(0).max(100).default(70).describe("Only include usage at or above this % of the limit"),
        entitlement: z.string().optional().describe("Only check this entitlement id"),
        limit: z.number().int().min(1).max(50).default(15),
      }),
      execute: async ({ minPercent, entitlement, limit }) => {
        // Walk the account list, then resolve each account's limits a few at a time.
        const accounts: { id: string; name: string; plan: string }[] = [];
        let total = 0;
        for (let page = 1; accounts.length < MAX_SCAN; page++) {
          const res = await get<{ data: { id: string; name: string; plan: string }[]; total: number }>("/namespaces", {
            q: "*",
            page,
            per_page: 100,
          });
          total = res.total;
          accounts.push(...res.data);
          if (res.data.length < 100 || accounts.length >= res.total) break;
        }

        type Resolved = { entitlements: { id: string; name: string; type: string; usage: number; max: number | null }[] };
        const rows: { accountId: string; name: string; plan: string; entitlement: string; usage: number; max: number; percent: number }[] = [];
        for (let i = 0; i < accounts.length; i += 8) {
          const batch = accounts.slice(i, i + 8);
          const plans = await Promise.all(
            batch.map((a) => get<Resolved>(`/namespaces/${enc(a.id)}/full-plan`).catch(() => null)),
          );
          batch.forEach((a, j) => {
            for (const e of plans[j]?.entitlements ?? []) {
              if (e.max === null || e.max <= 0 || (entitlement && e.id !== entitlement)) continue;
              const percent = Math.round((e.usage / e.max) * 100);
              if (percent >= minPercent) {
                rows.push({ accountId: a.id, name: a.name, plan: a.plan, entitlement: e.name, usage: e.usage, max: e.max, percent });
              }
            }
          });
        }

        rows.sort((a, b) => b.percent - a.percent);
        return { scannedAccounts: accounts.length, totalAccounts: total, matches: rows.length, results: rows.slice(0, limit) };
      },
    }),

    getUsage: tool({
      description: "Usage totals per entitlement for the whole app, or for one account when accountId is given.",
      inputSchema: z.object({ interval, accountId: z.string().optional() }),
      execute: async ({ interval, accountId }) => get("/analytics", { interval, namespace: accountId }),
    }),

    showCatalog: tool({
      description:
        "Show plans, entitlements, add-ons or incentives to the user as cards in the chat. Use it whenever the user asks to see, list, view or compare them; then add a short takeaway instead of repeating what the cards show.",
      inputSchema: z.object({
        kind: z.enum(["plans", "entitlements", "addons", "incentives"]),
        ids: z.array(z.string()).optional().describe("Only these records, in this order; omit for all"),
      }),
      execute: async ({ kind, ids }) => {
        const all = await catalog();
        const pool: { id: string }[] = all[kind];
        const records = ids?.length ? ids.flatMap((id) => pool.filter((r) => r.id === id)) : pool;
        const accounts =
          kind === "plans"
            ? Object.fromEntries(await Promise.all(records.map(async (p) => [p.id, await accountCount(p.id)] as const)))
            : undefined;
        // Which plans include each entitlement or add-on.
        const usedBy =
          kind === "entitlements" || kind === "addons"
            ? Object.fromEntries(
                records.map((r) => [
                  r.id,
                  all.plans
                    .filter((p) => (kind === "entitlements" ? p.entitlements.some((e) => e.id === r.id) : p.addons.includes(r.id)))
                    .map((p) => p.name),
                ]),
              )
            : undefined;
        return {
          kind,
          records,
          accounts,
          usedBy,
          entitlements: all.entitlements.map(({ id, name, type }) => ({ id, name, type })),
          addons: all.addons.map(({ id, name }) => ({ id, name })),
        };
      },
    }),

    // ---- Writes (each needs the user's approval) ----------------------------------

    createPlan: tool({
      description: "Create a plan, optionally with pricing, entitlements (with limits) and add-ons.",
      inputSchema: input.createPlanInput,
      execute: async (args): Promise<ChangeResult<Plan>> => {
        const { lookup } = await catalog();
        requireKnown(lookup, args.entitlements?.map((e) => e.id), args.addons);
        const created = await call<Plan>("POST", "/plans", {
          body: {
            id: args.id,
            name: args.name,
            description: args.description ?? null,
            isFree: args.isFree ?? false,
            pricingCard: applyPricing(null, args.pricing, args.name),
          },
        });
        await applyAttachments(
          `/plans/${enc(created.id)}`,
          created,
          { setEntitlements: args.entitlements, addAddons: args.addons },
          lookup,
        );
        return { kind: "plan", action: "created", before: null, after: await getRecord<Plan>("plan", created.id) };
      },
    }),

    updatePlan: tool({
      description:
        "Change a plan: name, description, internal note, free flag, pricing card, entitlement limits and add-ons. Only send what changes.",
      inputSchema: input.updatePlanInput,
      execute: async (args): Promise<ChangeResult<Plan>> => {
        const [before, { lookup }] = await Promise.all([getRecord<Plan>("plan", args.planId), catalog()]);
        requireKnown(lookup, args.setEntitlements?.map((e) => e.id), args.addAddons);
        const patch = planPatch(before, args);
        if (Object.keys(patch).length) await call("PATCH", `/plans/${enc(before.id)}`, { body: patch });
        await applyAttachments(`/plans/${enc(before.id)}`, before, args, lookup);
        return { kind: "plan", action: "updated", before, after: await getRecord<Plan>("plan", before.id) };
      },
    }),

    deletePlan: tool({
      description: "Delete a plan. Only possible when no accounts are on it.",
      inputSchema: input.deletePlanInput,
      execute: async ({ planId }): Promise<ChangeResult<Plan>> => {
        const before = await getRecord<Plan>("plan", planId);
        const count = await accountCount(planId);
        if (count > 0) {
          throw new Error(`${count} account${count === 1 ? " is" : "s are"} on this plan. Move them to another plan first.`);
        }
        await call("DELETE", `/plans/${enc(planId)}`);
        return { kind: "plan", action: "deleted", before, after: null, impact: [] };
      },
    }),

    createEntitlement: tool({
      description: "Create an entitlement: a usage limit (\"usage\") or an on/off feature (\"boolean\").",
      inputSchema: input.createEntitlementInput,
      execute: async (args): Promise<ChangeResult<Entitlement>> => {
        const after = await call<Entitlement>("POST", "/entitlements", { body: args });
        return { kind: "entitlement", action: "created", before: null, after };
      },
    }),

    updateEntitlement: tool({
      description: "Rename an entitlement or change its description. Limits live on plans and incentives.",
      inputSchema: input.updateEntitlementInput,
      execute: async ({ entitlementId, ...patch }): Promise<ChangeResult<Entitlement>> => {
        const before = await getRecord<Entitlement>("entitlement", entitlementId);
        const after = await call<Entitlement>("PATCH", `/entitlements/${enc(entitlementId)}`, { body: patch });
        return { kind: "entitlement", action: "updated", before, after };
      },
    }),

    deleteEntitlement: tool({
      description: "Delete an entitlement. It is removed from every plan and incentive first.",
      inputSchema: input.deleteEntitlementInput,
      execute: async ({ entitlementId }): Promise<ChangeResult<Entitlement>> => {
        const before = await getRecord<Entitlement>("entitlement", entitlementId);
        const impact = await detach("entitlements", entitlementId);
        await call("DELETE", `/entitlements/${enc(entitlementId)}`);
        return { kind: "entitlement", action: "deleted", before, after: null, impact };
      },
    }),

    createAddon: tool({
      description: "Create an add-on: an optional extra that plans and incentives can include.",
      inputSchema: input.createAddonInput,
      execute: async (args): Promise<ChangeResult<Addon>> => {
        const after = await call<Addon>("POST", "/addons", { body: args });
        return { kind: "addon", action: "created", before: null, after };
      },
    }),

    updateAddon: tool({
      description: "Rename an add-on or change its description.",
      inputSchema: input.updateAddonInput,
      execute: async ({ addonId, ...patch }): Promise<ChangeResult<Addon>> => {
        const before = await getRecord<Addon>("addon", addonId);
        const after = await call<Addon>("PATCH", `/addons/${enc(addonId)}`, { body: patch });
        return { kind: "addon", action: "updated", before, after };
      },
    }),

    deleteAddon: tool({
      description: "Delete an add-on. It is removed from every plan and incentive first.",
      inputSchema: input.deleteAddonInput,
      execute: async ({ addonId }): Promise<ChangeResult<Addon>> => {
        const before = await getRecord<Addon>("addon", addonId);
        const impact = await detach("addons", addonId);
        await call("DELETE", `/addons/${enc(addonId)}`);
        return { kind: "addon", action: "deleted", before, after: null, impact };
      },
    }),

    createIncentive: tool({
      description:
        "Create an incentive: limits that override an account's plan (higher or extra entitlements) plus add-ons. Applying it to accounts happens on the account.",
      inputSchema: input.createIncentiveInput,
      execute: async (args): Promise<ChangeResult<Incentive>> => {
        const { lookup } = await catalog();
        requireKnown(lookup, args.entitlements?.map((e) => e.id), args.addons);
        const created = await call<Incentive>("POST", "/incentives", {
          body: { id: args.id, name: args.name, description: args.description ?? null },
        });
        await applyAttachments(
          `/incentives/${enc(created.id)}`,
          created,
          { setEntitlements: args.entitlements, addAddons: args.addons },
          lookup,
        );
        return { kind: "incentive", action: "created", before: null, after: await getRecord<Incentive>("incentive", created.id) };
      },
    }),

    updateIncentive: tool({
      description: "Change an incentive: name, description, entitlement overrides and add-ons. Only send what changes.",
      inputSchema: input.updateIncentiveInput,
      execute: async ({ incentiveId, name, description, ...changes }): Promise<ChangeResult<Incentive>> => {
        const [before, { lookup }] = await Promise.all([getRecord<Incentive>("incentive", incentiveId), catalog()]);
        requireKnown(lookup, changes.setEntitlements?.map((e) => e.id), changes.addAddons);
        const patch = Object.fromEntries(Object.entries({ name, description }).filter(([, v]) => v !== undefined));
        if (Object.keys(patch).length) await call("PATCH", `/incentives/${enc(incentiveId)}`, { body: patch });
        await applyAttachments(`/incentives/${enc(incentiveId)}`, before, changes, lookup);
        return { kind: "incentive", action: "updated", before, after: await getRecord<Incentive>("incentive", incentiveId) };
      },
    }),

    deleteIncentive: tool({
      description: "Delete an incentive. It is removed from every account that has it first.",
      inputSchema: input.deleteIncentiveInput,
      execute: async ({ incentiveId }): Promise<ChangeResult<Incentive>> => {
        const before = await getRecord<Incentive>("incentive", incentiveId);
        const ids = await accountsWithIncentive(incentiveId);
        for (let i = 0; i < ids.length; i += 10) {
          await Promise.all(
            ids.slice(i, i + 10).map((id) =>
              call("DELETE", `/namespaces/${enc(id)}/incentive`).catch((e) => {
                // The search index is eventually consistent: an account deleted a moment ago is fine to skip.
                if (!(e instanceof OfferApiError && e.status === 404)) throw e;
              }),
            ),
          );
        }
        await call("DELETE", `/incentives/${enc(incentiveId)}`);
        const impact = ids.length
          ? [`Removed from ${ids.length} account${ids.length === 1 ? "" : "s"}, which fall back to their plan's limits`]
          : [];
        return { kind: "incentive", action: "deleted", before, after: null, impact };
      },
    }),

    getTopAccounts: tool({
      description: "Accounts ranked by usage, optionally for a single entitlement.",
      inputSchema: z.object({
        interval,
        entitlement: z.string().optional().describe("Entitlement id"),
        limit: z.number().int().min(1).max(25).default(10),
      }),
      execute: async ({ interval, entitlement, limit }) => get("/analytics/top-namespaces", { interval, entitlement, limit }),
    }),
  };
}

export type AgentTools = ReturnType<typeof agentTools>;
