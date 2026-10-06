import Link from "next/link";
import { DevLog } from "@/components/dev-log";
import { Flash } from "@/components/flash";
import { db } from "@/db";
import { accountPlan } from "@/lib/offer/account";
import { appApi } from "@/lib/offer/client";
import { offerConfig } from "@/lib/offer/config";
import { currentUser } from "@/lib/session";
import { destroyPost } from "./posts/actions";

const truncate = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);

export default async function PostsIndex({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const [user, config, posts] = await Promise.all([
    currentUser(),
    offerConfig(),
    db
      .selectFrom("posts")
      .innerJoin("user", "user.id", "posts.user_id")
      .selectAll("posts")
      .select(["user.name as author", "user.email"])
      .orderBy("posts.pinned", "desc")
      .orderBy("posts.id", "desc")
      .execute(),
  ]);
  const plan = user && config ? await accountPlan(appApi(config), user).catch(() => null) : null;
  const quota = plan?.entitlements.find((e) => e.id === "posts");

  return (
    <>
      <Flash notice={sp.notice} alert={sp.alert} />
      {!config && (
        <p id="alert">
          This blog isn&apos;t connected to the Offer API yet. Go to <Link href="/setup">Setup</Link>.
        </p>
      )}
      <h1>Listing posts</h1>

      <table className="data">
        <thead>
          <tr>
            <th>Title</th>
            <th>Body</th>
            <th>Author</th>
            <th></th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id}>
              <td>
                {post.pinned ? <i className="muted">[pinned] </i> : null}
                {post.title}
              </td>
              <td>{truncate(post.body)}</td>
              <td>{post.author || post.email}</td>
              <td>
                <Link href={`/posts/${post.id}`}>Show</Link>
              </td>
              <td>{user?.id === post.user_id && <Link href={`/posts/${post.id}/edit`}>Edit</Link>}</td>
              <td>
                {user?.id === post.user_id && (
                  <form className="inline" action={destroyPost.bind(null, post.id)}>
                    <button type="submit">Destroy</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {posts.length === 0 && <p className="muted">No posts yet.</p>}

      <br />
      {user ? <Link href="/posts/new">New Post</Link> : <Link href="/login">Log in to write a post</Link>}
      {quota && plan && (
        <span className="muted">
          {" "}
          &mdash; {quota.max === null ? `${quota.usage} posts, unlimited on ${plan.plan.name}` : `${quota.usage} of ${quota.max} posts used on ${plan.plan.name}`}
          {!quota.can && (
            <>
              {" "}
              (<Link href="/pricing">upgrade</Link>)
            </>
          )}
        </span>
      )}
      <DevLog title='GET "/posts"' />
    </>
  );
}
