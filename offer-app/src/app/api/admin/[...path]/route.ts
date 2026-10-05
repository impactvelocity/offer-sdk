import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth";
import {
  addSampleData,
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

interface BackendOrg {
  id: string;
  app_ids: string[];
}

const err = (status: number, error: string) => Response.json({ error }, { status });

/** The workspace's record in the Offer API, created on first use. */
async function backendOrg(orgId: string): Promise<BackendOrg> {
  try {
    return await offerApi<BackendOrg>("GET", `/orgs/${encodeURIComponent(orgId)}`);
  } catch (e) {
    if (e instanceof OfferApiError && e.status === 404) {
      return offerApi<BackendOrg>("POST", "/orgs", { id: orgId, app_ids: [] });
    }
    throw e;
  }
}

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

  try {
    if (path === "/workspace" && method === "GET") {
      return Response.json({ mode: offerApiMode, apiBaseUrl: publicApiBaseUrl(req.nextUrl.origin) });
    }

    if (path === "/workspace/apps") {
      const org = await backendOrg(orgId);
      if (method === "GET") return Response.json(await offerApi("GET", `/orgs/${encodeURIComponent(orgId)}/apps`));
      if (method === "POST") {
        const { name, sample } = createAppBody.parse(await readBody(req));
        const app = await offerApi<{ id: string }>("POST", "/apps", { name });
        // Read-modify-write of app_ids: fine for one admin at a time; move server-side with the real API.
        await offerApi("PATCH", `/orgs/${encodeURIComponent(orgId)}`, { app_ids: [...org.app_ids, app.id] });
        if (sample) await addSampleData(app.id, sample);
        return Response.json(app, { status: 201 });
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

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
