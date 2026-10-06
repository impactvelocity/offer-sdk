"use client";

import { Tabs } from "@base-ui/react/tabs";
import { LifeBuoy, ShoppingCart } from "lucide-react";
import type { ReactNode } from "react";
import { CheckoutDemo } from "./checkout-demo";
import { ChurnDemo } from "./churn-demo";

const scenarios: { id: string; label: string; blurb: string; icon: ReactNode; demo: ReactNode }[] = [
  { id: "churn", label: "Churn save", blurb: "A customer clicks cancel", icon: <LifeBuoy />, demo: <ChurnDemo /> },
  { id: "checkout", label: "Dynamic checkout", blurb: "One page, built per visitor", icon: <ShoppingCart />, demo: <CheckoutDemo /> },
];

/** The agentic scenarios, one tab each. Each tab keeps its own state while it's open. */
export function AgentDemo() {
  return (
    <Tabs.Root defaultValue="churn">
      <Tabs.List className="inline-grid grid-cols-2 gap-1 rounded-xl border border-border bg-panel p-1">
        {scenarios.map((s) => (
          <Tabs.Tab
            key={s.id}
            value={s.id}
            className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-left outline-none transition-colors hover:bg-bg-hover focus-visible:bg-bg-hover data-active:bg-bg-active sm:px-4"
          >
            <span className="text-fg-icon group-data-active:text-accent-fg [&_svg]:size-4">{s.icon}</span>
            <span>
              <span className="block text-sm font-medium text-fg-tertiary group-data-active:text-fg">{s.label}</span>
              <span className="hidden text-2xs text-fg-muted sm:block">{s.blurb}</span>
            </span>
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {scenarios.map((s) => (
        <Tabs.Panel key={s.id} value={s.id} className="feature-in mt-6 outline-none">
          {s.demo}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
