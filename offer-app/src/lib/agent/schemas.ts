import { z } from "zod";

// Input schemas for the agent's write tools. Shared by the server (tool definitions) and
// the chat UI (approval previews), so a preview always describes exactly what will run.

const recordId = (what: string) =>
  z.string().min(1).describe(`${what} id: lowercase letters, numbers and underscores, e.g. "pro_annual"`);

const entitlementLimit = z.object({
  id: z.string().min(1).describe("Entitlement id"),
  max: z
    .number()
    .int()
    .min(0)
    .nullable()
    .optional()
    .describe("Limit for usage entitlements; null means unlimited. Omit for feature (on/off) entitlements."),
});

const pricing = z
  .object({
    type: z.enum(["subscription", "one_time"]).optional(),
    monthlyPrice: z.number().min(0).nullable().optional(),
    yearlyPrice: z.number().min(0).nullable().optional(),
    price: z.number().min(0).nullable().optional().describe("One-time price"),
    currency: z.string().length(3).optional().describe("ISO code, e.g. USD"),
    title: z.string().optional().describe("Card title; defaults to the plan name"),
    description: z.string().nullable().optional(),
    featured: z.boolean().optional().describe('Highlight as "most popular"'),
    benefits: z.array(z.string()).optional().describe("Bullet points; replaces the current list"),
  })
  .describe("Pricing card fields, merged into the current card. Prices are in major units: 29 means $29.");

const attachmentChanges = {
  setEntitlements: z.array(entitlementLimit).optional().describe("Add entitlements or change their limits"),
  removeEntitlements: z.array(z.string()).optional().describe("Entitlement ids to remove"),
  addAddons: z.array(z.string()).optional().describe("Add-on ids to include"),
  removeAddons: z.array(z.string()).optional().describe("Add-on ids to remove"),
};

export const createPlanInput = z.object({
  id: recordId("Plan"),
  name: z.string().min(1),
  description: z.string().optional(),
  isFree: z.boolean().optional(),
  pricing: pricing.optional(),
  entitlements: z.array(entitlementLimit).optional(),
  addons: z.array(z.string()).optional(),
});

export const updatePlanInput = z.object({
  planId: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  note: z.string().nullable().optional().describe("Internal note, never shown to customers"),
  isFree: z.boolean().optional(),
  pricing: pricing.nullable().optional().describe("Pricing card changes; null removes the card"),
  ...attachmentChanges,
});

export const createEntitlementInput = z.object({
  id: recordId("Entitlement"),
  name: z.string().min(1),
  type: z.enum(["usage", "boolean"]).describe('"usage" for countable limits, "boolean" for on/off features'),
  description: z.string().optional(),
});

export const updateEntitlementInput = z.object({
  entitlementId: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

export const createAddonInput = z.object({
  id: recordId("Add-on"),
  name: z.string().min(1),
  description: z.string().optional(),
});

export const updateAddonInput = z.object({
  addonId: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

export const createIncentiveInput = z.object({
  id: recordId("Incentive"),
  name: z.string().min(1),
  description: z.string().optional(),
  entitlements: z.array(entitlementLimit).optional().describe("Limits that override the account's plan"),
  addons: z.array(z.string()).optional(),
});

export const updateIncentiveInput = z.object({
  incentiveId: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  ...attachmentChanges,
});

export const deletePlanInput = z.object({ planId: z.string().min(1) });
export const deleteEntitlementInput = z.object({ entitlementId: z.string().min(1) });
export const deleteAddonInput = z.object({ addonId: z.string().min(1) });
export const deleteIncentiveInput = z.object({ incentiveId: z.string().min(1) });

export type EntitlementLimitInput = z.infer<typeof entitlementLimit>;
export type PricingInput = z.infer<typeof pricing>;
export type CreatePlanInput = z.infer<typeof createPlanInput>;
export type UpdatePlanInput = z.infer<typeof updatePlanInput>;
export type CreateEntitlementInput = z.infer<typeof createEntitlementInput>;
export type UpdateEntitlementInput = z.infer<typeof updateEntitlementInput>;
export type CreateAddonInput = z.infer<typeof createAddonInput>;
export type UpdateAddonInput = z.infer<typeof updateAddonInput>;
export type CreateIncentiveInput = z.infer<typeof createIncentiveInput>;
export type UpdateIncentiveInput = z.infer<typeof updateIncentiveInput>;
