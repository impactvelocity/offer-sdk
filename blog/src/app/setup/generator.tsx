"use client";

import { useActionState } from "react";
import { generate, type SetupState } from "./actions";

export function Generator({ connected }: { connected: boolean }) {
  const [state, action, pending] = useActionState<SetupState, FormData>(generate, {});
  return (
    <form action={action}>
      {!connected && (
        <p>
          <label>
            App name: <input name="name" defaultValue="Rails Blog" size={20} />
          </label>
        </p>
      )}
      <p>
        <input type="submit" disabled={pending} value={pending ? "Generating…" : connected ? "rails generate offer:install (re-sync)" : "rails generate offer:install"} />
      </p>
      {state.error && <p className="fail">{state.error}</p>}
      {state.lines && (
        <pre className="generator">
          {state.lines.map((l, i) => (
            <span key={i}>
              <span className={`v-${l.verb}`}>{l.verb.padStart(9)}</span>
              {"  "}
              {l.what}
              {l.detail && <span style={{ color: "#999" }}>{`  ${l.detail}`}</span>}
              {"\n"}
            </span>
          ))}
        </pre>
      )}
    </form>
  );
}
