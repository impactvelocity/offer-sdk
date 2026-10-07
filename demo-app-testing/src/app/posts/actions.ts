"use server";

import { redirect } from "next/navigation";
import { db, now } from "@/db";
import { withNotice } from "@/components/flash";
import { accountPath, accountPlan, can, ensureAccount } from "@/lib/offer/account";
import { isStatus, offerApi } from "@/lib/offer/client";
import type { LimitReached } from "@/lib/offer/types";
import { requireUser } from "@/lib/session";

export interface FormState {
  errors?: string[];
  upgrade?: { url: string | null; text: string };
  values?: { title: string; body: string; pinned: boolean };
}

function validate(title: string, body: string) {
  const errors: string[] = [];
  if (!title) errors.push("Title can't be blank");
  else if (title.length < 5) errors.push("Title is too short (minimum is 5 characters)");
  if (!body) errors.push("Body can't be blank");
  return errors;
}

const read = (form: FormData) => ({
  title: String(form.get("title") ?? "").trim(),
  body: String(form.get("body") ?? "").trim(),
  pinned: form.get("pinned") === "1",
});

async function ownPost(id: number) {
  const user = await requireUser();
  const post = await db.selectFrom("posts").selectAll().where("id", "=", id).executeTakeFirst();
  if (!post) redirect(withNotice("/", "Post not found.", "alert"));
  if (post.user_id !== user.id) redirect(withNotice(`/posts/${id}`, "You can only change your own posts.", "alert"));
  return { user, post };
}

// POST /posts: the API enforces the `posts` limit (overage: block). Over it,
// /usage/posts/add answers 402 with an upgrade offer instead of counting.
export async function createPost(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = read(form);
  const errors = validate(values.title, values.body);
  if (errors.length) return { errors, values };

  const api = await offerApi();
  await ensureAccount(api, user);
  if (values.pinned && !can(await accountPlan(api, user), "pin_posts")) {
    return { errors: ["Pinned is not included in your plan"], values };
  }

  try {
    await api.post(`${accountPath(user.id)}/usage/posts/add`);
  } catch (err) {
    if (isStatus(err, 402)) {
      const body = err.body as LimitReached;
      return {
        errors: [`Posts limit reached: ${body.entitlement.usage} of ${body.entitlement.max} used`],
        upgrade: { url: body.offer?.checkout_url ?? "/pricing", text: body.message },
        values,
      };
    }
    throw err;
  }

  const post = await db
    .insertInto("posts")
    .values({ user_id: user.id, title: values.title, body: values.body, pinned: values.pinned ? 1 : 0, created_at: now(), updated_at: now() })
    .returning("id")
    .executeTakeFirstOrThrow();
  redirect(withNotice(`/posts/${post.id}`, "Post was successfully created."));
}

export async function updatePost(id: number, _: FormState, form: FormData): Promise<FormState> {
  const { user } = await ownPost(id);
  const values = read(form);
  const errors = validate(values.title, values.body);
  if (errors.length) return { errors, values };

  if (values.pinned && !can(await accountPlan(await offerApi(), user), "pin_posts")) {
    return { errors: ["Pinned is not included in your plan"], values };
  }

  await db
    .updateTable("posts")
    .set({ title: values.title, body: values.body, pinned: values.pinned ? 1 : 0, updated_at: now() })
    .where("id", "=", id)
    .execute();
  redirect(withNotice(`/posts/${id}`, "Post was successfully updated."));
}

// DELETE /posts/:id gives the post back: /usage/posts/remove.
export async function destroyPost(id: number) {
  const { user } = await ownPost(id);
  await db.deleteFrom("comments").where("post_id", "=", id).execute();
  await db.deleteFrom("posts").where("id", "=", id).execute();
  const api = await offerApi();
  await api.post(`${accountPath(user.id)}/usage/posts/remove`);
  redirect(withNotice("/", "Post was successfully destroyed."));
}

export interface CommentState {
  errors?: string[];
}

// Comments count against the blog owner's `comments` limit. This one is a soft
// limit: the app checks `can` on /plan first, then records the usage.
export async function createComment(postId: number, _: CommentState, form: FormData): Promise<CommentState> {
  const commenter = String(form.get("commenter") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const errors = [!commenter && "Commenter can't be blank", !body && "Body can't be blank"].filter(Boolean) as string[];
  if (errors.length) return { errors };

  const post = await db
    .selectFrom("posts")
    .innerJoin("user", "user.id", "posts.user_id")
    .select(["posts.id", "user.id as author_id", "user.name", "user.email"])
    .where("posts.id", "=", postId)
    .executeTakeFirst();
  if (!post) return { errors: ["Post not found"] };

  const api = await offerApi();
  const author = { id: post.author_id, name: post.name, email: post.email };
  if (!can(await accountPlan(api, author), "comments")) {
    return { errors: ["This blog has used all the comments on its plan"] };
  }
  await api.post(`${accountPath(author.id)}/usage/comments/add`);
  await db.insertInto("comments").values({ post_id: postId, commenter, body, created_at: now() }).execute();
  redirect(withNotice(`/posts/${postId}`, "Comment was successfully created."));
}
