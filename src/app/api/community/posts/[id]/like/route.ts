import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { platformDb } from "@/server/db/platform";
import { likes, posts } from "@/server/db/platform-schema";
import { ensureProfile, getSession } from "@/server/community";
import { isAllowedOrigin } from "@/server/origin-check";
import { rateLimit } from "@/server/rate-limit";

/** Toggles a like. Returns the new state + count. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to like posts" }, { status: 401 });

  const { allowed } = await rateLimit(`like:${session.user.id}`, 60, 3600);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const post = await platformDb.select({ id: posts.id }).from(posts).where(eq(posts.id, id)).get();
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  await ensureProfile(session.user.id, session.user.name);

  const existing = await platformDb
    .select()
    .from(likes)
    .where(and(eq(likes.postId, id), eq(likes.userId, session.user.id)))
    .get();

  let liked: boolean;
  if (existing) {
    await platformDb.delete(likes).where(and(eq(likes.postId, id), eq(likes.userId, session.user.id)));
    await platformDb
      .update(posts)
      .set({ likeCount: sql`MAX(0, ${posts.likeCount} - 1)` })
      .where(eq(posts.id, id));
    liked = false;
  } else {
    await platformDb.insert(likes).values({
      postId: id,
      userId: session.user.id,
      createdAt: new Date().toISOString(),
    });
    await platformDb
      .update(posts)
      .set({ likeCount: sql`${posts.likeCount} + 1` })
      .where(eq(posts.id, id));
    liked = true;
  }
  const updated = await platformDb
    .select({ likeCount: posts.likeCount })
    .from(posts)
    .where(eq(posts.id, id))
    .get();
  return NextResponse.json({ liked, likeCount: updated?.likeCount ?? 0 });
}
