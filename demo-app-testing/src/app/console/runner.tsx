"use client";

import { useState, useTransition } from "react";
import type { SuiteResult, TestResult } from "@/lib/offer/suite";
import { rakeTest } from "./actions";

const DOT = { pass: ".", fail: "F", skip: "*" } as const;

function Calls({ result }: { result: TestResult }) {
  return (
    <>
      {result.calls.map((c, i) => (
        <div key={i} className="muted">
          <code>
            {c.method} {c.path.replace(/\/apps\/app_\w+/, "…")} [{c.key}] → {c.status}
          </code>
        </div>
      ))}
    </>
  );
}

export function Runner() {
  const [suite, setSuite] = useState<SuiteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showAll, setShowAll] = useState(false);

  const run = () =>
    start(async () => {
      setError(null);
      try {
        setSuite(await rakeTest());
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });

  const count = (o: TestResult["outcome"]) => suite?.results.filter((r) => r.outcome === o).length ?? 0;
  const groups = suite ? [...new Set(suite.results.map((r) => r.group))] : [];

  return (
    <>
      <p>
        <button type="button" onClick={run} disabled={pending}>
          {pending ? "Running…" : "$ rake test"}
        </button>{" "}
        {suite && (
          <label>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show API calls for every test
          </label>
        )}
      </p>
      {error && <p className="fail">{error}</p>}

      {suite && (
        <>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {`Run options: --seed ${suite.results.length}\n\n# Running:\n\n`}
            {suite.results.map((r, i) => (
              <span key={i} className={r.outcome === "fail" ? "fail" : r.outcome === "skip" ? "warn" : "pass"}>
                {DOT[r.outcome]}
              </span>
            ))}
            {`\n\nFinished in ${(suite.ms / 1000).toFixed(2)}s.\n`}
            <b className={count("fail") ? "fail" : "pass"}>
              {suite.results.length} tests, {count("fail")} failures, {count("skip")} pending
            </b>
          </pre>

          {groups.map((g) => (
            <div key={g}>
              <h3>{g}</h3>
              <table className="data">
                <tbody>
                  {suite.results
                    .filter((r) => r.group === g)
                    .map((r, i) => (
                      <tr key={i}>
                        <td className={r.outcome === "fail" ? "fail" : r.outcome === "skip" ? "warn" : "pass"}>
                          {r.outcome === "pass" ? "✓" : r.outcome === "fail" ? "✗" : "*"}
                        </td>
                        <td>
                          {r.name}
                          {(showAll || r.outcome === "fail") && <Calls result={r} />}
                        </td>
                        <td className={r.outcome === "fail" ? "fail" : "muted"}>{r.detail}</td>
                        <td className="muted">{r.ms}ms</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </>
  );
}
