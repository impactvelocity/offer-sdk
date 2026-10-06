import Link from "next/link";
import { notFound } from "next/navigation";
import { DevLog } from "@/components/dev-log";
import { Flash } from "@/components/flash";
import { db } from "@/db";
import { currentUser } from "@/lib/session";
import { createComment, destroyPost } from "../actions";
import { CommentForm } from "../comment-form";

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const [post, user] = await Promise.all([
    db
      .selectFrom("posts")
      .innerJoin("user", "user.id", "posts.user_id")
      .selectAll("posts")
      .select(["user.name as author", "user.email"])
      .where("posts.id", "=", id)
      .executeTakeFirst(),
    currentUser(),
  ]);
  if (!post) notFound();
  const comments = await db.selectFrom("comments").selectAll().where("post_id", "=", id).orderBy("id").execute();

  return (
    <>
      <Flash notice={sp.notice} alert={sp.alert} />
      <p>
        <b>Title:</b>
        <br />
        {post.title} {post.pinned ? <i className="muted">[pinned]</i> : null}
      </p>
      <p>
        <b>Body:</b>
        <br />
        <span style={{ whiteSpace: "pre-wrap" }}>{post.body}</span>
      </p>
      <p>
        <b>Author:</b>
        <br />
        {post.author || post.email}
      </p>

      <h2>Comments</h2>
      {comments.length === 0 && <p className="muted">No comments yet.</p>}
      {comments.map((c) => (
        <div key={c.id}>
          <p>
            <b>Commenter:</b> {c.commenter}
          </p>
          <p>
            <b>Comment:</b> {c.body}
          </p>
        </div>
      ))}

      <h2>Add a comment:</h2>
      <CommentForm action={createComment.bind(null, id)} />

      {user?.id === post.user_id && (
        <>
          <Link href={`/posts/${id}/edit`}>Edit</Link> |{" "}
          <form className="inline" action={destroyPost.bind(null, id)}>
            <button type="submit">Destroy</button>
          </form>{" "}
          |{" "}
        </>
      )}
      <Link href="/">Back</Link>
      <DevLog title={`GET "/posts/${id}"`} />
    </>
  );
}
