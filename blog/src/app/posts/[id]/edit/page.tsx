import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DevLog } from "@/components/dev-log";
import { withNotice } from "@/components/flash";
import { db } from "@/db";
import { accountPlan, can } from "@/lib/offer/account";
import { offerApi } from "@/lib/offer/client";
import { requireUser } from "@/lib/session";
import { updatePost } from "../../actions";
import { PostForm } from "../../post-form";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const user = await requireUser();
  const post = await db.selectFrom("posts").selectAll().where("id", "=", id).executeTakeFirst();
  if (!post) notFound();
  if (post.user_id !== user.id) redirect(withNotice(`/posts/${id}`, "You can only change your own posts.", "alert"));
  const plan = await accountPlan(await offerApi(), user);

  return (
    <>
      <h1>Editing post</h1>
      <PostForm
        action={updatePost.bind(null, id)}
        post={{ title: post.title, body: post.body, pinned: !!post.pinned }}
        canPin={can(plan, "pin_posts")}
        submit="Update Post"
      />
      <Link href={`/posts/${id}`}>Show</Link> | <Link href="/">Back</Link>
      <DevLog title={`GET "/posts/${id}/edit"`} />
    </>
  );
}
