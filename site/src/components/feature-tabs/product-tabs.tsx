import { Blocks, Boxes, Database, Sparkles } from "lucide-react";
import { FeatureTabs, type FeatureTab } from "./feature-tabs";
import { AgentVisual, ApiVisual, BundlesVisual, SdkVisual } from "./visuals";

const tabs: FeatureTab[] = [
  {
    id: "api",
    label: "Entitlements API",
    blurb: "One call per account",
    icon: <Database />,
    tone: "teal",
    title: "One call returns everything an account can use",
    body: "The API combines an account's plan, offer extras and incentive into one list of features and limits. Create offers, grant access and record usage over REST.",
    points: [
      "Plan, then offer extras, then incentive, applied in that order",
      "A 402 with an upgrade offer when an account hits a hard limit",
      "Webhooks and an OpenAPI spec",
    ],
    visual: <ApiVisual />,
  },
  {
    id: "sdk",
    label: "React SDK",
    blurb: "Write the paywall once",
    icon: <Blocks />,
    tone: "violet",
    title: "Write the paywall once",
    body: "Wrap your app in the provider and check access wherever a feature is gated. Change plans, prices and bundles in the dashboard, and the same code handles each one.",
    points: [
      "Lock features and show limits in your UI",
      "Show an upgrade prompt when an account reaches a limit",
      "Add plans and offers without a redeploy",
    ],
    visual: <SdkVisual />,
  },
  {
    id: "agent",
    label: "Agentic Offers",
    blurb: "An offer chosen per account",
    icon: <Sparkles />,
    tone: "pink",
    title: "An agent that makes the offer at the cancel button",
    body: "When a customer hits a limit, asks for help or clicks cancel, the agent reads their usage and history, picks from the offers you allow, writes the copy and links it to PayPal checkout.",
    points: [
      "A save offer at cancel, an upgrade at the limit",
      "Stays inside the discount limits you set",
      "Every suggestion checks out through PayPal",
    ],
    visual: <AgentVisual />,
  },
  {
    id: "bundles",
    label: "Dynamic Bundles",
    blurb: "A link for every partner",
    icon: <Boxes />,
    tone: "orange",
    title: "Give every partner their own deal",
    body: "Give an affiliate, an influencer or a weekend sale its own mix of plans, add-ons and price. Each one gets a link to the same checkout page, and you can edit it while it's live.",
    points: [
      "Per-partner pricing on one checkout page",
      "Mix plans, add-ons, trials and discounts",
      "Set an expiry date and the link stops selling",
    ],
    visual: <BundlesVisual />,
  },
];

export function ProductTabs({ className }: { className?: string }) {
  return (
    <div className={className}>
      <FeatureTabs tabs={tabs} />
    </div>
  );
}
