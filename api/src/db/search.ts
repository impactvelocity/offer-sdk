import sql from "./client.ts";

// Same document shape the legacy Typesense collection returned.
export type NamespaceHit = {
  id: string;
  namespace_id: string;
  name: string;
  plan: string;
  has_incentive: boolean;
  incentive?: string;
  created_at: number; // unix seconds
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

// Replaces Typesense: filter by plan/incentive, substring match on name or id,
// newest first.
export async function searchNamespaces(params: {
  appId: string;
  q?: string;
  plan?: string;
  incentive?: string;
  offer?: string;
  hasIncentive?: boolean;
  page?: number;
  perPage?: number;
}): Promise<{ hits: NamespaceHit[]; found: number }> {
  const page = params.page ?? 1;
  const perPage = Math.min(params.perPage ?? 20, 100);
  const q = params.q?.trim();
  const pattern = q && q !== "*" ? `%${escapeLike(q)}%` : null;
  const plan = params.plan ?? null;
  const incentive = params.incentive ?? null;
  const offer = params.offer ?? null;
  const hasIncentive = params.hasIncentive ?? null;

  const where = sql`
    app_id = ${params.appId}
    and (${plan}::text is null or plan = ${plan})
    and (${incentive}::text is null or incentive = ${incentive})
    and (${offer}::text is null or (offer_id = ${offer} and data -> 'subscription' ->> 'status' = 'active'))
    and (${hasIncentive}::boolean is not true or incentive is not null)
    and (${pattern}::text is null or name ilike ${pattern} or id ilike ${pattern})`;

  const [rows, [{ found }]] = await Promise.all([
    sql`
      select id, name, plan, incentive, extract(epoch from created_at)::bigint::float8 as created_at
      from namespaces
      where ${where}
      order by namespaces.created_at desc, namespaces.id
      limit ${perPage} offset ${(page - 1) * perPage}`,
    sql`select count(*)::int as found from namespaces where ${where}`,
  ]);

  const hits = rows.map((r: { id: string; name: string; plan: string; incentive: string | null; created_at: number }) => ({
    id: r.id,
    namespace_id: r.id,
    name: r.name,
    plan: r.plan,
    has_incentive: !!r.incentive,
    ...(r.incentive ? { incentive: r.incentive } : {}),
    created_at: r.created_at,
  }));

  return { hits, found };
}
