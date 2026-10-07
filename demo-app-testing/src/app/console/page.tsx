import { OFFER_API_URL } from "@/lib/offer/config";
import { Runner } from "./runner";

export default function ConsolePage() {
  return (
    <>
      <h1>rake test</h1>
      <p>
        Runs every Offer API route and SDK entry point against {OFFER_API_URL}: auth rules for each key type, catalog CRUD, accounts, usage
        limits and the 402, incentives, offers and checkout, webhooks (including a signed delivery back to this app), analytics, and the SDK
        helpers. It uses a throwaway account and scratch records, and deletes them at the end.
      </p>
      <p className="muted">
        Headless: <code>curl -s localhost:6770/api/rake | jq .summary</code> (HTTP 500 if anything fails).
      </p>
      <Runner />
    </>
  );
}
