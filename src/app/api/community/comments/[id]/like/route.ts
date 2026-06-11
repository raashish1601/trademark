import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { platformDb } from "@/server/db/platform";
import { commentLikes, comments } from "@/server/db/platform-schema";
import { ensureProfile, getSession, notify } from "@/server/community";
import { isAllowedOrigin } from "@/server/origin-check";
import { rateLimit } from "@/server/rate-limit";

/** Toggles a like on a comment. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to like" }, { status: 401 });

  const { allowed } = await rateLimit(`clike:${session.user.id}`, 60, 3600);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const comment = await platformDb.select().from(comments).where(eq(comments.id, id)).get();
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  await ensureProfile(session.user.id, session.user.name);

  const existing = await platformDb
    .select()
    .from(commentLikes)
    .where(and(eq(commentLikes.commentId, id), eq(commentLikes.userId, session.user.id)))
    .get();

  let liked: boolean;
  if (existing) {
    await platformDb
      .delete(commentLikes)
      .where(and(eq(commentLikes.commentId, id), eq(commentLikes.userId, session.user.id)));
    await platformDb
      .update(comments)
      .set({ likeCount: sql`MAX(0, ${comments.likeCount} - 1)` })
      .where(eq(comments.id, id));
    liked = false;
  } else {
    await platformDb.insert(commentLikes).values({
      commentId: id,
      userId: session.user.id,
      createdAt: new Date().toISOString(),
    });
    await platformDb
      .update(comments)
      .set({ likeCount: sql`${comments.likeCount} + 1` })
      .where(eq(comments.id, id));
    await notify({
      userId: comment.userId,
      actorId: session.user.id,
      type: "like",
      postId: comment.postId,
      commentId: id,
    });
    liked = true;
  }
  const updated = await platformDb
    .select({ likeCount: comments.likeCount })
    .from(comments)
    .where(eq(comments.id, id))
    .get();
  return NextResponse.json({ liked, likeCount: updated?.likeCount ?? 0 });
}
