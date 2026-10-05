import { describe, expect, it } from "vitest";
import {
  applyPricing,
  catalogLookup,
  diffRecord,
  previewIncentiveUpdate,
  previewNewPlan,
  previewPlanUpdate,
} from "@/lib/agent/changes";
import { titleFromText } from "@/lib/agent/title";
import type { Addon, Entitlement, Incentive, Plan } from "@/lib/api/types";

// The agent's approval cards preview a change with these helpers, so they must match what
// the write tools do through the API.

const entitlements = [
  { id: "ai_credits", name: "AI credits", type: "usage" },
  { id: "seats", name: "Seats", type: "usage" },
  { id: "sso", name: "SSO", type: "boolean" },
] as Entitlement[];
const addons = [{ id: "boost", name: "Boost" }] as Addon[];
const lookup = catalogLookup(entitlements, addons);

const pro: Plan = {
  id: "pro",
  app_id: "app_1",
  name: "Pro",
  description: "For teams",
  isFree: false,
  pricingCard: {
    title: "Pro",
    benefits: [{ id: "b1", title: "Priority support" }],
    type: "subscription",
    monthlyPrice: 29,
    yearlyPrice: 290,
    currency: "USD",
  },
  entitlements: [
    { id: "ai_credits", max: 1000 },
    { id: "seats", max: 5 },
  ],
  addons: [],
  meta: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("agent change previews", () => {
  it("applies plan updates: fields, pricing, limits and add-ons", () => {
    const after = previewPlanUpdate(
      pro,
      {
        planId: "pro",
        name: "Pro Plus",
        pricing: { monthlyPrice: 39, benefits: ["Priority support", "Custom domain"] },
        setEntitlements: [{ id: "ai_credits", max: 5000 }, { id: "sso", max: 3 }],
        removeEntitlements: ["seats"],
        addAddons: ["boost"],
      },
      lookup,
    );
    expect(after.name).toBe("Pro Plus");
    expect(after.pricingCard).toMatchObject({ monthlyPrice: 39, yearlyPrice: 290, title: "Pro" });
    expect(after.pricingCard?.benefits.map((b) => b.title)).toEqual(["Priority support", "Custom domain"]);
    expect(after.pricingCard?.benefits[0].id).toBe("b1");
    // Feature entitlements carry no max, like the API stores them.
    expect(after.entitlements).toEqual([{ id: "ai_credits", max: 5000 }, { id: "sso" }]);
    expect(after.addons).toEqual(["boost"]);
  });

  it("removes or creates a pricing card", () => {
    expect(applyPricing(pro.pricingCard, null, "Pro")).toBeNull();
    expect(applyPricing(null, { monthlyPrice: 9, currency: "eur" }, "Starter")).toMatchObject({
      title: "Starter",
      monthlyPrice: 9,
      currency: "EUR",
      benefits: [],
    });
  });

  it("describes what changes", () => {
    const after = previewPlanUpdate(
      pro,
      { planId: "pro", pricing: { monthlyPrice: 39 }, setEntitlements: [{ id: "ai_credits", max: null }, { id: "sso" }], removeEntitlements: ["seats"] },
      lookup,
    );
    expect(diffRecord("plan", pro, after, lookup)).toEqual([
      { key: "monthly", label: "Monthly price", op: "change", from: "$29", to: "$39" },
      { key: "entitlement:ai_credits", label: "AI credits", op: "change", from: "1,000", to: "Unlimited" },
      { key: "entitlement:sso", label: "SSO", op: "add", to: "Included" },
      { key: "entitlement:seats", label: "Seats", op: "remove", from: "5" },
    ]);
    expect(diffRecord("plan", pro, pro, lookup)).toEqual([]);
  });

  it("lists every field a new record sets", () => {
    const plan = previewNewPlan({ id: "team", name: "Team", entitlements: [{ id: "seats", max: 20 }], addons: ["boost"] }, "app_1", lookup);
    expect(diffRecord("plan", null, plan, lookup)).toEqual([
      { key: "name", label: "Name", op: "set", to: "Team" },
      { key: "entitlement:seats", label: "Seats", op: "add", to: "20" },
      { key: "addon:boost", label: "Add-on", op: "add", to: "Boost" },
    ]);
  });

  it("updates incentives", () => {
    const promo: Incentive = {
      id: "promo",
      app_id: "app_1",
      name: "Promo",
      entitlements: [{ id: "ai_credits", max: 2000 }],
      addons: ["boost"],
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const after = previewIncentiveUpdate(promo, { incentiveId: "promo", description: "Spring", removeAddons: ["boost"] }, lookup);
    expect(after).toMatchObject({ description: "Spring", addons: [], entitlements: promo.entitlements });
  });

  it("titles a chat from its first line", () => {
    expect(titleFromText("  Raise Pro's limits\nthanks")).toBe("Raise Pro's limits");
    expect(titleFromText("x".repeat(80))).toHaveLength(58);
    expect(titleFromText("   ")).toBe("New chat");
  });
});
