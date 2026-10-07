import { requestLog } from "@/lib/offer/client";

/**
 * log/development.log for this render: every Offer API call the server made.
 * Render it last in a page, after the page's own awaits.
 */
export function DevLog({ title }: { title: string }) {
  const log = requestLog();
  const total = log.reduce((ms, e) => ms + e.ms, 0);
  return (
    <div id="devlog">
      <pre>
        {`Started ${title}\n`}
        {log.length === 0 && "  (no Offer API calls)\n"}
        {log.map((e, i) => (
          <span key={i}>
            {"  Offer API "}
            {e.method.padEnd(6)} {e.path}{" "}
            <span className="muted">[{e.key}]</span>{" "}
            <span className={typeof e.status === "number" ? `s${String(e.status)[0]}` : "s5"}>{e.status}</span> in {e.ms}ms{"\n"}
          </span>
        ))}
        {`Completed with ${log.length} API call${log.length === 1 ? "" : "s"} (${total}ms)`}
      </pre>
    </div>
  );
}
