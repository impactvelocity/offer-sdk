export interface CancelConfig {
  apiUrl: string;
  appId: string;
  /**
   * Account token minted by your server with your secret key
   * (`POST /apps/:appId/namespaces/:accountId/token`). It can only act for
   * that one account, so it's safe in the browser; the publishable key can't
   * cancel anyone.
   */
  token: string;
  fetch?: typeof fetch;
}

export type CancelStatus = "open" | "saved" | "cancelled" | "abandoned";

export interface QuestionStep {
  id: string;
  type: "question";
  title: string;
  description: string | null;
  /** `text: true` answers ask for more detail ("Which tool?"). */
  answers: { id: string; label: string; text: boolean }[];
}

export interface TextStep {
  id: string;
  type: "text";
  title: string;
  description: string | null;
  placeholder: string | null;
  required: boolean;
}

export interface OfferStep {
  id: string;
  type: "offer";
  title: string | null;
  decline_label: string | null;
}

export interface ConfirmStep {
  id: string;
  type: "confirm";
  title: string;
  description: string | null;
  cta: string | null;
}

export type CancelStep = QuestionStep | TextStep | OfferStep | ConfirmStep;

export type SaveOfferKind = "discount" | "pause" | "downgrade" | "incentive";

/** The numbers behind an offer; which fields are set depends on `kind`. */
export interface SaveOfferDetails {
  /** discount */
  percent?: number;
  cycles?: number;
  /** discount and downgrade: the new price, and the current one */
  price?: number;
  regular_price?: number;
  currency?: string;
  interval?: string;
  /** pause and incentive */
  months?: number;
  resume_at?: string;
  /** downgrade */
  plan?: string;
  plan_name?: string;
  /** incentive */
  incentive?: string;
  incentive_name?: string;
  description?: string | null;
  ends_at?: string;
}

export interface SaveOffer {
  kind: SaveOfferKind;
  /** "dynamic" when Claude picked it for this customer. */
  source: "static" | "dynamic";
  details: SaveOfferDetails;
  headline: string;
  body: string;
  cta: string;
  status: "shown" | "accepted" | "declined";
  result?: Record<string, unknown>;
}

export interface CancelSession {
  id: string;
  status: CancelStatus;
  flow: { id: string; name: string };
  /** The step to show; null once the session is saved, cancelled or abandoned. */
  step: CancelStep | null;
  progress: { index: number; total: number };
  can_go_back: boolean;
  offer: SaveOffer | null;
  /** Set when accepting needs the customer to approve a new price on PayPal. */
  approve_url: string | null;
  result: ({ outcome: "saved" | "cancelled" } & Record<string, unknown>) | null;
  account: {
    id: string;
    plan_name: string;
    subscription: { price: number; currency: string; interval: string; renews_at: string | null } | null;
  };
}

/** What the provider talks to: the API (CancelClient), or a stand-in for previews. */
export interface CancelTransport {
  start(flow?: string | null): Promise<CancelSession>;
  answer(sessionId: string, body: { step: string; answer?: string | null; text?: string | null }): Promise<CancelSession>;
  back(sessionId: string): Promise<CancelSession>;
  decline(sessionId: string): Promise<CancelSession>;
  accept(sessionId: string, urls?: { return_url?: string; cancel_url?: string }): Promise<CancelSession>;
  cancel(sessionId: string): Promise<CancelSession>;
  close(sessionId: string): Promise<CancelSession>;
}
