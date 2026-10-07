import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Callout } from "@/components/ui/callout";
import { getSession } from "@/server/auth";
import { consentApps, getConsentRequest, type ConsentRequest } from "@/server/mcp-consent";
import { offerApiMode, OfferApiError } from "@/server/offer-api";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Connect an MCP client" };

// Where MCP clients (Claude, Cursor, …) send people to approve a connection. The hosted
// API's /oauth/authorize redirects here with ?request=; the form posts to ./decide.
export default async function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  const params = await searchParams;
  const id = typeof params.request === "string" ? params.request : "";
  const error = typeof params.error === "string" ? params.error : null;

  if (offerApiMode !== "remote") {
    return <Problem title="MCP needs the hosted API">This dashboard runs against the in-memory mock, which has no MCP server.</Problem>;
  }
  if (!id) return <Problem title="Nothing to approve">Start connecting from your MCP client; it opens this page for you.</Problem>;

  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/oauth/consent?request=${id}`)}`);

  let request: ConsentRequest;
  try {
    request = await getConsentRequest(id);
  } catch (e) {
    if (e instanceof OfferApiError) return <Problem title="Can't connect">{e.message}</Problem>;
    throw e;
  }

  const apps = await consentApps();
  if (request.app_id && !apps.some((a) => a.id === request.app_id)) {
    return (
      <Problem title="You don't have access to this app" denyRequest={id}>
        {request.client.name} wants to connect to {request.app_name ?? request.app_id}, which isn&apos;t in any of your workspaces.
        Ask a workspace admin to invite you, or sign in with another account.
      </Problem>
    );
  }
  if (request.server && !request.server.enabled) {
    return (
      <Problem title="This app's MCP server is off" denyRequest={id}>
        Turn it on under Developers → MCP server in {request.app_name ?? "the app"}, then connect again.
      </Problem>
    );
  }
  if (!request.app_id && !apps.length) {
    return (
      <Problem title="No apps yet" denyRequest={id}>
        Create an app first, then connect {request.client.name} to it.
      </Problem>
    );
  }

  return <ConsentForm request={request} apps={request.app_id ? [] : apps} user={session.user} error={error} />;
}

function Problem({ title, children, denyRequest }: { title: string; children: React.ReactNode; denyRequest?: string }) {
  return (
    <div className="w-full max-w-[420px]">
      <div className="rounded-xl border border-border bg-bg p-6 shadow-sm">
        <h1 className="font-display text-xl font-semibold text-fg">{title}</h1>
        <Callout tone="warning" className="mt-4">
          {children}
        </Callout>
        {denyRequest ? (
          <form method="post" action="/oauth/consent/decide" className="mt-4">
            <input type="hidden" name="request" value={denyRequest} />
            <input type="hidden" name="decision" value="deny" />
            <button type="submit" className="text-sm font-medium text-accent-fg hover:underline">
              Back to the client
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
