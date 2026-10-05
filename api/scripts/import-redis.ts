// One-off copy of the legacy Upstash Redis data into Postgres.
//
//   UPSTASH_REDIS_REST_URL=… UPSTASH_REDIS_REST_TOKEN=… DATABASE_URL=… bun run import:redis [--dry-run]
//
// Read-only against Redis. Idempotent against Postgres (existing rows are left
// alone), so it can be re-run right before cutover to pick up new data.
// Usage *history* lived in Tinybird and is not copied; current counters are.
import sql from "../src/db/client.ts";
import { migrate } from "../src/db/migrate.ts";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");

if (!REDIS_URL || !REDIS_TOKEN) {
  console.error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required");
  process.exit(1);
}

type Doc = Record<string, any>;

async function pipeline(commands: (string | number)[][]): Promise<any[]> {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`);
  const out = (await res.json()) as { result?: unknown; error?: string }[];
  return out.map((r, i) => {
    if (r.error) throw new Error(`Upstash ${commands[i]?.[0]}: ${r.error}`);
    return r.result;
  });
}

async function scan(match: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [[next, batch]] = await pipeline([["SCAN", cursor, "MATCH", match, "COUNT", 1000]]);
    cursor = String(next);
    keys.push(...batch);
  } while (cursor !== "0");
  return keys;
}

const chunk = <T>(xs: T[], n: number) =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function jsonDocs(match: string): Promise<{ key: string; doc: Doc }[]> {
  const keys = await scan(match);
  const out: { key: string; doc: Doc }[] = [];
  for (const batch of chunk(keys, 500)) {
    const results = await pipeline(batch.map((k) => ["JSON.GET", k, "$"]));
    results.forEach((raw, i) => {
      const doc = raw ? JSON.parse(raw as string)?.[0] : null;
      if (doc) out.push({ key: batch[i], doc });
    });
  }
  return out;
}

const createdAt = (doc: Doc) => (doc.created_at && !isNaN(Date.parse(doc.created_at)) ? doc.created_at : null);

const stats: Record<string, { found: number; inserted: number; skipped: number }> = {};
const track = (name: string) => (stats[name] ??= { found: 0, inserted: 0, skipped: 0 });

if (!DRY_RUN) await migrate();

// Apps
const appIds = new Set<string>();
for (const { doc } of await jsonDocs("app:*")) {
  const s = track("apps");
  s.found++;
  appIds.add(doc.id);
  if (DRY_RUN) continue;
  const rows = await sql`
    insert into apps (id, api_key, public_key, data, created_at)
    values (${doc.id}, ${doc.api_key}, ${doc.public_key}, ${doc}::jsonb, coalesce(${createdAt(doc)}::timestamptz, now()))
    on conflict do nothing
    returning id`;
  rows.length ? s.inserted++ : s.skipped++;
}

// Orgs
for (const { doc } of await jsonDocs("org:*")) {
  const s = track("orgs");
  s.found++;
  if (DRY_RUN) continue;
  const rows = await sql`
    insert into orgs (id, data, created_at)
    values (${doc.id}, ${doc}::jsonb, coalesce(${createdAt(doc)}::timestamptz, now()))
    on conflict do nothing
    returning id`;
  rows.length ? s.inserted++ : s.skipped++;
}

// Per-app documents. Keys are `{type}:{appId}:{id}`; the id is taken from the
// key (that's how the legacy API addressed it) and may itself contain colons.
const namespaceKeys = new Set<string>();
const tables = [
  ["entitlement", "entitlements"],
  ["addon", "addons"],
  ["plan", "plans"],
  ["incentive", "incentives"],
  ["namespace", "namespaces"],
] as const;

for (const [prefix, table] of tables) {
  for (const { key, doc } of await jsonDocs(`${prefix}:*`)) {
    const s = track(table);
    s.found++;
    const [, appId, ...rest] = key.split(":");
    const id = rest.join(":");
    if (!appIds.has(appId)) {
      s.skipped++; // orphan: its app was deleted
      continue;
    }
    if (table === "namespaces") namespaceKeys.add(`${appId}:${id}`);
    if (DRY_RUN) continue;
    const rows = await sql.unsafe(
      `insert into ${table} (app_id, id, data, created_at)
       values ($1, $2, $3::jsonb, coalesce($4::timestamptz, now()))
       on conflict do nothing
       returning id`,
      [appId, id, doc, createdAt(doc)],
    );
    rows.length ? s.inserted++ : s.skipped++;
  }
}

// Usage counters: `usage:{appId}:{namespaceId}:{entitlementId}`.
const usageKeys = await scan("usage:*");
for (const batch of chunk(usageKeys, 500)) {
  const values = await pipeline([["MGET", ...batch]]).then(([v]) => v as (string | null)[]);
  for (const [i, key] of batch.entries()) {
    const s = track("usage_counters");
    s.found++;
    const parts = key.split(":");
    const appId = parts[1];
    const entitlementId = parts[parts.length - 1];
    const namespaceId = parts.slice(2, -1).join(":");
    const count = Number(values[i] ?? 0);
    if (!namespaceKeys.has(`${appId}:${namespaceId}`) || !Number.isFinite(count)) {
      s.skipped++; // namespace was deleted
      continue;
    }
    if (DRY_RUN) continue;
    const rows = await sql`
      insert into usage_counters (app_id, namespace_id, entitlement_id, count)
      values (${appId}, ${namespaceId}, ${entitlementId}, ${count})
      on conflict do nothing
      returning count`;
    rows.length ? s.inserted++ : s.skipped++;
  }
}

console.table(stats);
if (DRY_RUN) console.log("Dry run: nothing was written.");
await sql.close();
