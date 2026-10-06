import { runSuite } from "@/lib/offer/suite";

export const dynamic = "force-dynamic";

// curl -s localhost:6770/api/rake | jq '.summary'   (HTTP 500 when anything fails)
export async function GET() {
  const suite = await runSuite();
  const count = (o: string) => suite.results.filter((r) => r.outcome === o).length;
  const summary = { tests: suite.results.length, failures: count("fail"), pending: count("skip"), ms: suite.ms };
  const failures = suite.results.filter((r) => r.outcome === "fail").map((r) => ({ test: `${r.group}: ${r.name}`, detail: r.detail, calls: r.calls }));
  return Response.json({ summary, failures, results: suite.results }, { status: summary.failures ? 500 : 200 });
}
