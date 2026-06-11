import { NextResponse } from "next/server";
import { eq, asc, inArray } from "drizzle-orm";
import { platformDb } from "@/server/db/platform";
import { comments, posts, profiles } from "@/server/db/platform-schema";
import { deletePostCascade, getSession, hydratePosts } from "@/server/community";
import { isAllowedOrigin } from "@/server/origin-check";
import type { CommentView } from "@/features/community/types";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  const row = await platformDb.select().from(posts).where(eq(posts.id, id)).get();
  if (!row) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const [post] = await hydratePosts([row], session?.user.id ?? null);
  const commentRows = await platformDb
    .select()
    .from(comments)
    .where(eq(comments.postId, id))
    .orderBy(asc(comments.createdAt));
  const authorIds = [...new Set(commentRows.map((c) => c.userId))];
  const authors = authorIds.length
    ? await platformDb.select().from(profiles).where(inArray(profiles.userId, authorIds))
    : [];
  const authorMap = new Map(authors.map((a) => [a.userId, a]));

  const commentViews: CommentView[] = commentRows.map((c) => {
    const a = authorMap.get(c.userId);
    return {
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      mine: session?.user.id === c.userId,
      author: a
        ? { username: a.username, displayName: a.displayName }
        : { username: "deleted", displayName: "Deleted user" },
    };
  });

  return NextResponse.json({ post, comments: commentViews });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const row = await platformDb.select().from(posts).where(eq(posts.id, id)).get();
  if (!row) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (row.userId !== session.user.id)
    return NextResponse.json({ error: "Only the author can delete this" }, { status: 403 });
  await deletePostCascade(id);
  return NextResponse.json({ deleted: true });
}
