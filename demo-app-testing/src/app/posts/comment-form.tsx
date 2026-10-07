"use client";

import { useActionState } from "react";
import { ErrorExplanation } from "@/components/flash";
import type { CommentState } from "./actions";

export function CommentForm({ action }: { action: (state: CommentState, form: FormData) => Promise<CommentState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction}>
      <ErrorExplanation errors={state.errors} model="comment" />
      <div className="field">
        <label htmlFor="comment_commenter">Commenter</label>
        <br />
        <input id="comment_commenter" name="commenter" type="text" size={30} />
      </div>
      <div className="field">
        <label htmlFor="comment_body">Body</label>
        <br />
        <textarea id="comment_body" name="body" cols={40} rows={4} />
      </div>
      <div className="actions">
        <input type="submit" value="Create Comment" disabled={pending} />
      </div>
    </form>
  );
}
