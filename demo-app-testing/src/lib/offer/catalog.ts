// What /setup creates in the Offer API: the blog's whole catalog. Ids use
// underscores because the API slugifies ids (hyphens are dropped).

export const ENTITLEMENTS = [
  { id: "posts", type: "usage", name: "Posts", description: "Published blog posts." },
  { id: "comments", type: "usage", name: "Comments", description: "Comments received across all posts." },
  { id: "pin_posts", type: "boolean", name: "Pin posts", description: "Keep a post at the top of the list." },
] as const;

export const ADDONS = [{ id: "priority_support", name: "Priority support", description: "A human answers within a day." }];

export const PLANS = [
  {
    id: "free",
    name: "Free",
    description: "Kick the tyres.",
    isFree: true,
    pricingCard: { title: "Free", type: "subscription", monthlyPrice: 0, yearlyPrice: 0, currency: "USD", featured: false, benefits: [{ id: "b1", title: "3 posts" }] },
    entitlements: [{ id: "posts", max: 3 }, { id: "comments", max: 20 }],
    addons: [] as string[],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For the prolific blogger.",
    isFree: false,
    pricingCard: { title: "Pro", type: "subscription", monthlyPrice: 9, yearlyPrice: 90, currency: "USD", featured: true, benefits: [{ id: "b1", title: "50 posts" }, { id: "b2", title: "Unlimited comments" }, { id: "b3", title: "Pinned posts" }] },
    entitlements: [{ id: "posts", max: 50 }, { id: "comments", max: null }, { id: "pin_posts" }],
    addons: [] as string[],
  },
  {
    id: "business",
    name: "Business",
    description: "A whole newsroom.",
    isFree: false,
    pricingCard: { title: "Business", type: "subscription", monthlyPrice: 29, yearlyPrice: 290, currency: "USD", featured: false, benefits: [{ id: "b1", title: "Unlimited posts" }, { id: "b2", title: "Priority support" }] },
    entitlements: [{ id: "posts", max: null }, { id: "comments", max: null }, { id: "pin_posts" }],
    addons: ["priority_support"],
  },
];

export const INCENTIVES = [
  {
    id: "beta_tester",
    name: "Beta tester",
    description: "Promo code BETA: 25 posts and priority support on any plan.",
    entitlements: [{ id: "posts", max: 25 }],
    addons: ["priority_support"],
  },
];

/** Promo codes the account page accepts, mapped to incentive ids. */
export const PROMO_CODES: Record<string, string> = { BETA: "beta_tester" };

export const OFFERS = [
  {
    id: "launch_50",
    name: "Launch week: 50% off",
    copy: {
      headline: "Half price for three months",
      subhead: "Celebrate launch week. Pro or Business at 50% off, then regular price.",
      cta: "Start blogging",
      bullets: ["Cancel anytime", "Keep every post you write"],
    },
    discount: { percent: 50, cycles: 3 },
    intervals: ["month", "year"],
    plans: [{ plan_id: "pro", entitlements: [{ id: "posts", max: 75 }] }, { plan_id: "business" }],
    default_plan: "pro",
    bumps: [
      {
        id: "support",
        label: "Add priority support",
        description: "Jump the queue for a one-time $19.",
        price: { amount: 19 },
        grant: { addons: ["priority_support"] },
      },
      {
        id: "posts_pack",
        label: "+20 bonus posts",
        description: "One-time credit pack.",
        price: { amount: 5 },
        grant: { credits: { entitlement: "posts", amount: 20 } },
        applies_to: { plans: ["pro"] },
      },
    ],
  },
  {
    id: "lifetime",
    name: "Lifetime deal",
    copy: { headline: "Pay once, blog forever" },
    intervals: ["once"],
    plans: [{ plan_id: "pro", prices: { once: { amount: 149 } } }],
  },
];

/** Events the blog's webhook endpoint subscribes to. */
export const WEBHOOK_EVENTS = ["*"];
