import type { NextRequest } from "next/server";
import { z } from "zod";
import { DEMO_READ_ONLY_MESSAGE, demoAllows } from "@/lib/demo";
import { getSession, isDemoUser } from "@/server/auth";
import {
  backendOrg,
  createWorkspaceApp,
  offerApi,
  OfferApiError,
  offerApiFetch,
  offerApiMode,
  publicApiBaseUrl,
} from "@/server/offer-api";

export const dynamic = "force-dynamic";

// Backend-for-frontend for the dashboard. Every request needs a signed-in user with an
// active workspace (better-auth organization). App routes are forwarded unchanged to the
// Offer API with the admin key, but only for apps that belong to that workspace.
//
//   GET  /api/admin/workspace            mode + public API base URL
//   GET  /api/admin/workspace/apps       apps in the active workspace
//   POST /api/admin/workspace/apps       create an app (optionally with sample data)
//   *    /api/admin/apps/:appId/...      passthrough to the Offer API
//
// The shared demo login only reads (plus a couple of previews): see @/lib/demo.

const err = (status: number, error: string) => Response.json({ error }, { status });

const createAppBody = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  sample: z.enum(["saas", "course"]).nullish(),
});

async function readBody(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new OfferApiError(400, "Invalid JSON body");
  }
}

async function handle(req: NextRequest, ctx: RouteContext<"/api/admin/[...path]">) {
  const session = await getSession();
  if (!session) return err(401, "Not signed in");
  const orgId = session.session.activeOrganizationId;
  if (!orgId) return err(403, "No active workspace");

  const segments = (await ctx.params).path;
  const path = `/${segments.map(encodeURIComponent).join("/")}`;
  const method = req.method;
  if (isDemoUser(session.user) && !demoAllows(method, segments)) return err(403, DEMO_READ_ONLY_MESSAGE);

  try {
    if (path === "/workspace" && method === "GET") {
      return Response.json({ mode: offerApiMode, apiBaseUrl: publicApiBaseUrl(req.nextUrl.origin) });
    }

    if (path === "/workspace/apps") {
      if (method === "GET") {
        await backendOrg(orgId);
        return Response.json(await offerApi("GET", `/orgs/${encodeURIComponent(orgId)}/apps`));
      }
      if (method === "POST") {
        return Response.json(await createWorkspaceApp(orgId, createAppBody.parse(await readBody(req))), { status: 201 });
      }
      return err(405, "Method not allowed");
    }

    if (segments[0] === "apps" && segments[1]) {
      const appId = segments[1];
      const org = await backendOrg(orgId);
      if (!org.app_ids.includes(appId)) return err(404, "App not found");
      // Agent threads are private to each user: only /api/agent/threads serves them.
      if (segments[2] === "agent") return err(404, `Route not found: ${method} ${path}`);

      const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
      const upstream = await offerApiFetch(method, path, { query: req.nextUrl.searchParams, body });

      // Keep the workspace's app list in sync when an app is deleted.
      if (method === "DELETE" && segments.length === 2 && upstream.ok) {
        await offerApi("PATCH", `/orgs/${encodeURIComponent(orgId)}`, {
          app_ids: org.app_ids.filter((id) => id !== appId),
        });
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
      });
    }

    return err(404, `Route not found: ${method} ${path}`);
  } catch (e) {
    if (e instanceof z.ZodError) return err(400, e.issues[0]?.message ?? "Invalid request");
    if (e instanceof OfferApiError) return err(e.status, e.message);
    console.error("[admin api]", e);
    return err(502, "Could not reach the Offer API");
  }
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
