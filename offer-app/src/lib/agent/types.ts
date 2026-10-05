import type { UIMessage } from "ai";
import type { Addon, Entitlement, Incentive, Plan } from "@/lib/api/types";

/** A saved agent chat, as listed in the thread sidebar. */
export interface AgentThreadSummary {
  id: string;
  app_id: string;
  user_id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface AgentThread extends Omit<AgentThreadSummary, "message_count"> {
  messages: UIMessage[];
}

export type CatalogKind = "plan" | "entitlement" | "addon" | "incentive";

export type CatalogRecord = Plan | Entitlement | Addon | Incentive;

/** What every write tool returns once the change is applied. */
export type ChangeResult<T extends CatalogRecord = CatalogRecord> =
  | { kind: CatalogKind; action: "created"; before: null; after: T }
  | { kind: CatalogKind; action: "updated"; before: T; after: T }
  | { kind: CatalogKind; action: "deleted"; before: T; after: null; impact: string[] };

/** Tools that change the catalog. Each waits for the user's approval before it runs. */
export const WRITE_TOOLS = [
  "createPlan",
  "updatePlan",
  "deletePlan",
  "createEntitlement",
  "updateEntitlement",
  "deleteEntitlement",
  "createAddon",
  "updateAddon",
  "deleteAddon",
  "createIncentive",
  "updateIncentive",
  "deleteIncentive",
] as const;

export type WriteToolName = (typeof WRITE_TOOLS)[number];

export const isWriteTool = (name: string): name is WriteToolName => (WRITE_TOOLS as readonly string[]).includes(name);
