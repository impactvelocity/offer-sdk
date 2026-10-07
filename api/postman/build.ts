// Builds the Postman collection and environment from requests.ts.
//
//   bun run postman        (or: docker compose exec api bun run postman)
//
// Fails when a route registered in src/app.ts has no request in requests.ts, or a
// request points at a route that no longer exists. test/postman.test.ts runs the
// same check and also fails when the committed JSON is out of date.
import { FOLDERS, VARIABLES, type Auth, type RequestDef } from "./requests.ts";

export const COLLECTION_FILE = new URL("./offer-api.postman_collection.json", import.meta.url).pathname;
export const ENVIRONMENT_FILE = new URL("./offer-api.postman_environment.json", import.meta.url).pathname;

/** Route params → the collection variable that fills them. */
export const PARAM_VARIABLES: Record<string, string> = {
  appId: "appId",
  namespaceId: "accountId",
  planId: "planId",
  entitlementId: "entitlementId",
  addonId: "addonId",
  incentiveId: "incentiveId",
  offerId: "offerId",
  checkoutId: "checkoutId",
  webhookId: "webhookId",
  deliveryId: "deliveryId",
  flowId: "flowId",
  sessionId: "sessionId",
  id: "reportId",
  orgId: "orgId",
  threadId: "threadId",
};

/** Dashboard sign-in, which only the dashboard calls (proxied, with the admin key). */
const EXCLUDED = [/^\/api\/auth\//];

/** "METHOD /path" for every route the app serves, middleware left out. */
export function apiRoutes(app: { routes: { method: string; path: string }[] }): string[] {
  const routes = app.routes
    .filter((r) => r.method !== "ALL" && !EXCLUDED.some((re) => re.test(r.path)))
    .map((r) => `${r.method} ${r.path}`);
  return [...new Set(routes)].sort();
}

export function coverage(routes: string[]) {
  const requested = new Set(FOLDERS.flatMap((f) => f.requests.map((r) => `${r.method} ${r.path}`)));
  const served = new Set(routes);
  return {
    missing: routes.filter((r) => !requested.has(r)),
    unknown: [...requested].filter((r) => !served.has(r)).sort(),
  };
}

const bearer = (variable: string) => ({ type: "bearer", bearer: [{ key: "token", value: `{{${variable}}}`, type: "string" }] });

const AUTH: Record<Exclude<Auth, "secret">, object> = {
  none: { type: "noauth" },
  public: bearer("publicKey"),
  token: bearer("accountToken"),
  admin: bearer("adminKey"),
};

function url(def: RequestDef) {
  const path = def.path
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (!segment.startsWith(":")) return segment;
      const param = segment.slice(1);
      const value = def.params?.[param] ?? (PARAM_VARIABLES[param] ? `{{${PARAM_VARIABLES[param]}}}` : undefined);
      if (!value) throw new Error(`${def.method} ${def.path}: no variable for :${param}`);
      return value;
    });
  const query = def.query?.map(({ key, value, description, disabled }) => ({
    key,
    value,
    ...(description ? { description } : {}),
    ...(disabled ? { disabled: true } : {}),
  }));
  const search = (query ?? []).filter((q) => !q.disabled).map((q) => `${q.key}=${q.value}`).join("&");
  return {
    raw: `{{baseUrl}}/${path.join("/")}${search ? `?${search}` : ""}`,
    host: ["{{baseUrl}}"],
    path,
    ...(query?.length ? { query } : {}),
  };
}

// Copies response fields into collection variables after a successful call.
function saveScript(save: Record<string, string>) {
  return [
    "if (pm.response.code < 300) {",
    "  let body = null;",
    "  try { body = pm.response.json(); } catch (e) {}",
    '  const pick = (path) => path.split(".").reduce((value, key) => (value == null ? value : value[key]), body);',
    ...Object.entries(save).map(
      ([variable, path]) =>
        `  if (pick(${JSON.stringify(path)}) != null) pm.collectionVariables.set(${JSON.stringify(variable)}, String(pick(${JSON.stringify(path)})));`,
    ),
    "}",
  ];
}

function item(def: RequestDef) {
  const hasBody = def.body !== undefined;
  return {
    name: def.name,
    ...(def.save
      ? { event: [{ listen: "test", script: { type: "text/javascript", exec: saveScript(def.save) } }] }
      : {}),
    request: {
      method: def.method,
      ...(def.auth === "secret" ? {} : { auth: AUTH[def.auth] }),
      header: hasBody ? [{ key: "Content-Type", value: "application/json" }] : [],
      ...(hasBody
        ? { body: { mode: "raw", raw: JSON.stringify(def.body, null, 2), options: { raw: { language: "json" } } } }
        : {}),
      url: url(def),
      ...(def.description ? { description: def.description } : {}),
    },
    response: [],
  };
}

const DESCRIPTION = `Every route of the Offer API (Offer SDK's Hono service).

1. Start the API locally (\`pnpm dev:api\`) or point \`baseUrl\` at a deployed one with the environment file.
2. Run the **Quickstart** folder top to bottom. It creates an app and saves its keys into the collection variables.
3. Every other folder then works on that app. You can also run the whole collection in order.
4. **Clean up** deletes what the run created, ending with the app.

Requests send the app's secret key unless their Auth tab says otherwise: browser routes use the publishable key, cancel sessions use an account token, and the Admin folder uses the admin key.

Generated from api/postman/requests.ts. Run \`bun run postman\` in api/ after changing routes.`;

export function buildCollection() {
  return {
    info: {
      _postman_id: "6f2a9c3e-5b1d-4e8f-9a7c-2d4b6e8f0a13",
      name: "Offer API",
      description: DESCRIPTION,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: bearer("secretKey"),
    event: [
      {
        listen: "test",
        script: {
          type: "text/javascript",
          exec: ['pm.test("No server error", () => pm.expect(pm.response.code).to.be.below(500));'],
        },
      },
    ],
    variable: VARIABLES.map(({ key, value, description }) => ({ key, value, type: "string", description })),
    item: FOLDERS.map((folder) => ({ name: folder.name, description: folder.description, item: folder.requests.map(item) })),
  };
}

/** For a deployed API: overrides baseUrl and adminKey, nothing else (so saved ids stay in the collection). */
export function buildEnvironment() {
  return {
    id: "0b7d4e21-8c3f-4a6b-9e15-7f2c1d9a3b48",
    name: "Offer API (deployed)",
    values: [
      { key: "baseUrl", value: "https://offersdk-api.onrender.com", type: "default", enabled: true },
      { key: "adminKey", value: "", type: "secret", enabled: true },
    ],
    _postman_variable_scope: "environment",
  };
}

export const toJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

if (import.meta.main) {
  const { default: app } = await import("../src/app.ts");
  const { missing, unknown } = coverage(apiRoutes(app));
  if (missing.length || unknown.length) {
    if (missing.length) console.error(`Routes with no request in requests.ts:\n  ${missing.join("\n  ")}`);
    if (unknown.length) console.error(`Requests with no matching route:\n  ${unknown.join("\n  ")}`);
    process.exit(1);
  }
  await Bun.write(COLLECTION_FILE, toJson(buildCollection()));
  await Bun.write(ENVIRONMENT_FILE, toJson(buildEnvironment()));
  const count = FOLDERS.reduce((n, f) => n + f.requests.length, 0);
  console.log(`Wrote ${count} requests in ${FOLDERS.length} folders to ${COLLECTION_FILE}`);
  process.exit(0);
}
