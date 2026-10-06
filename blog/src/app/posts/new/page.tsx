import Link from "next/link";
import { DevLog } from "@/components/dev-log";
import { accountPlan, can } from "@/lib/offer/account";
import { offerApi } from "@/lib/offer/client";
import { requireUser } from "@/lib/session";
import { createPost } from "../actions";
import { PostForm } from "../post-form";

export default async function NewPostPage() {
  const user = await requireUser();
  const plan = await accountPlan(await offerApi(), user);
  const posts = plan.entitlements.find((e) => e.id === "posts");

  return (
    <>
      <h1>New post</h1>
      {posts && (
        <p className="muted">
          {posts.max === null ? `${posts.usage} posts so far (unlimited on ${plan.plan.name}).` : `${posts.usage} of ${posts.max} posts used on ${plan.plan.name}.`}
        </p>
      )}
      <PostForm action={createPost} canPin={can(plan, "pin_posts")} submit="Create Post" />
      <Link href="/">Back</Link>
      <DevLog title='GET "/posts/new"' />
    </>
  );
}
