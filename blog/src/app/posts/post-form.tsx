"use client";

import { useActionState } from "react";
import { ErrorExplanation } from "@/components/flash";
import type { FormState } from "./actions";

// app/views/posts/_form.html.erb
export function PostForm({
  action,
  post,
  canPin,
  submit,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  post?: { title: string; body: string; pinned: boolean };
  canPin: boolean;
  submit: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values ?? post ?? { title: "", body: "", pinned: false };
  const hasError = (field: string) => state.errors?.some((e) => e.startsWith(field));
  // f.label / f.text_field wrap themselves in .field_with_errors when invalid.
  const field = (name: string, node: React.ReactNode) => (hasError(name) ? <div className="field_with_errors">{node}</div> : node);

  return (
    <form action={formAction}>
      <ErrorExplanation errors={state.errors} />
      {state.upgrade && (
        <p style={{ width: 450 }}>
          {state.upgrade.text.replace(/ Upgrade here: \S+$/, "")}{" "}
          {state.upgrade.url && (
            <a href={state.upgrade.url}>
              <b>Upgrade now &raquo;</b>
            </a>
          )}
        </p>
      )}
      <div className="field">
        {field("Title", <label htmlFor="post_title">Title</label>)}
        <br />
        {field("Title", <input id="post_title" name="title" type="text" size={30} defaultValue={values.title} key={`t${values.title}`} />)}
      </div>
      <div className="field">
        {field("Body", <label htmlFor="post_body">Body</label>)}
        <br />
        {field("Body", <textarea id="post_body" name="body" cols={40} rows={10} defaultValue={values.body} key={`b${values.body}`} />)}
      </div>
      <div className="field">
        <label>
          <input type="checkbox" name="pinned" value="1" defaultChecked={values.pinned} disabled={!canPin} /> Pinned
        </label>
        {!canPin && (
          <span className="muted">
            {" "}
            (<code>pin_posts</code> isn&apos;t on your plan: <a href="/pricing">upgrade</a>)
          </span>
        )}
      </div>
      <div className="actions">
        <input type="submit" value={submit} disabled={pending} />
      </div>
    </form>
  );
}
