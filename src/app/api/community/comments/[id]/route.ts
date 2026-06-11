import { NextResponse } from "next/server";
import { eq, inArray, sql } from "drizzle-orm";
import { platformDb } from "@/server/db/platform";
import { commentLikes, comments, posts } from "@/server/db/platform-schema";
import { getSession } from "@/server/community";
import { isAllowedOrigin } from "@/server/origin-check";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await platformDb.select().from(comments).where(eq(comments.id, id)).get();
  if (!row) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  if (row.userId !== session.user.id)
    return NextResponse.json({ error: "Only the author can delete this" }, { status: 403 });

  // Deleting a top-level comment removes its replies too (and all their likes).
  const replies = await platformDb
    .select({ id: comments.id })
    .from(comments)
    .where(eq(comments.parentId, id));
  const ids = [id, ...replies.map((r) => r.id)];
  await platformDb.delete(commentLikes).where(inArray(commentLikes.commentId, ids));
  await platformDb.delete(comments).where(inArray(comments.id, ids));
  await platformDb
    .update(posts)
    .set({ commentCount: sql`MAX(0, ${posts.commentCount} - ${ids.length})` })
    .where(eq(posts.id, row.postId));
  return NextResponse.json({ deleted: true });
}
