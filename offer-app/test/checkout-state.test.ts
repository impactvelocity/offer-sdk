import { describe, expect, test } from "vitest";
import {
  availableBumps,
  formatMoney,
  initialSelection,
  normalize,
  priceLabel,
  renewalLabel,
  savings,
  summarize,
} from "@/sdk/checkout/state";
import type { PublicOffer } from "@/sdk/checkout/types";

const offer: PublicOffer = {
  id: "5050",
  name: "Half off",
  type: "shareable",
  expires_at: null,
  currency: "USD",
  copy: {},
  intervals: ["month", "year"],
  default_plan: "pro",
  default_interval: "month",
  plans: [
    {
      id: "basic",
      name: "Basic",
      description: null,
      featured: false,
      benefits: [],
      prices: {
        month: { amount: 10, list_price: 20, cycles: 3, then: 20 },
        year: { amount: 100, list_price: 200, cycles: 3, then: 200 },
      },
      extras: [],
      extra_addons: [],
    },
    {
      id: "pro",
      name: "Pro",
      description: null,
      featured: true,
      benefits: [],
      prices: { month: { amount: 49.5, list_price: 99, cycles: 3, then: 99 } },
      extras: [{ id: "scrapes", name: "Scrapes", max: 12000 }],
      extra_addons: [],
    },
  ],
  bumps: [
    { id: "call", label: "Welcome call", description: null, amount: 50, applies_to: { plans: ["pro"] }, addons: [] },
    { id: "pack", label: "Scrape pack", description: null, amount: 19, applies_to: null, addons: [] },
  ],
  resolved_from: "requested",
  requested: null,
  paypal: { client_id: "client", env: "sandbox" },
};

describe("checkout selection", () => {
  test("starts on the offer's default plan and interval", () => {
    expect(initialSelection(offer)).toEqual({ plan: "pro", interval: "month", bumps: [] });
    expect(initialSelection(offer, { plan: "basic", interval: "year" })).toEqual({ plan: "basic", interval: "year", bumps: [] });
  });

  test("switching interval keeps a plan sold for it", () => {
    // Pro has no yearly price, so yearly falls back to the first plan that has one.
    expect(normalize(offer, { plan: "pro", interval: "year", bumps: [] })).toEqual({ plan: "basic", interval: "year", bumps: [] });
  });

  test("drops bumps that don't apply", () => {
    expect(availableBumps(offer, { plan: "basic", interval: "month", bumps: [] }).map((b) => b.id)).toEqual(["pack"]);
    expect(normalize(offer, { plan: "basic", interval: "month", bumps: ["call", "pack"] }).bumps).toEqual(["pack"]);
  });

  test("summary totals today's charge and the renewal", () => {
    const summary = summarize(offer, { plan: "pro", interval: "month", bumps: ["call", "pack"] });
    expect(summary.totalToday).toBe(118.5);
    expect(summary.renewal).toEqual({ amount: 99, afterCycles: 3 });
    expect(summary.ready).toBe(true);
    expect(summarize(offer, { plan: null, interval: "month", bumps: [] }).ready).toBe(false);
  });
});

describe("formatting", () => {
  test("prices", () => {
    expect(formatMoney(10, "USD")).toBe("$10");
    expect(formatMoney(49.5, "USD")).toBe("$49.50");
    expect(priceLabel(49.5, "month", "USD")).toBe("$49.50/mo");
    expect(priceLabel(299, "once", "USD")).toBe("$299");
  });

  test("renewal and savings", () => {
    expect(renewalLabel({ amount: 10, list_price: 20, cycles: 3, then: 20 }, "month", "USD")).toBe("for 3 months, then $20/mo");
    expect(renewalLabel({ amount: 100, list_price: 200, cycles: 1, then: 200 }, "year", "USD")).toBe("for 1 year, then $200/yr");
    expect(renewalLabel({ amount: 20, list_price: 20, cycles: null, then: null }, "month", "USD")).toBeNull();
    expect(savings({ amount: 49.5, list_price: 99, cycles: 3, then: 99 })).toBe(50);
    expect(savings({ amount: 79.2, list_price: 99, cycles: 3, then: 99 })).toBe(20);
    expect(savings({ amount: 20, list_price: 20, cycles: null, then: null })).toBeNull();
  });
});
