import { FeatureTabs, type FeatureTab } from "./feature-tabs";
import { AgentVisual, ApiVisual, BundlesVisual, SdkVisual } from "./visuals";

const tabs: FeatureTab[] = [
  {
    id: "api",
    label: "Entitlements API",
    tone: "violet",
    title: "One call returns everything an account can use",
    body: "Plan, offer extras and incentives, merged into one list of features and limits.",
    visual: <ApiVisual />,
  },
  {
    id: "sdk",
    label: "React SDK",
    tone: "green",
    title: "Write the paywall once",
    body: "Check access wherever a feature is gated. Plans and prices change in the dashboard, the code stays the same.",
    visual: <SdkVisual />,
  },
  {
    id: "agent",
    label: "Agentic Offers",
    tone: "pink",
    title: "An agent that makes the offer at the cancel button",
    body: "It reads the account's usage, picks from the offers you allow and links straight to PayPal checkout.",
    visual: <AgentVisual />,
  },
  {
    id: "bundles",
    label: "Dynamic Bundles",
    tone: "orange",
    title: "Give every partner their own deal",
    body: "Each affiliate, influencer or sale gets its own mix and price, on one checkout page.",
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
