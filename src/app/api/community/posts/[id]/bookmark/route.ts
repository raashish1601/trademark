import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { platformDb } from "@/server/db/platform";
import { bookmarks, posts } from "@/server/db/platform-schema";
import { ensureProfile, getSession } from "@/server/community";
import { isAllowedOrigin } from "@/server/origin-check";
import { rateLimit } from "@/server/rate-limit";

/** Toggles a private bookmark on a post. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to save posts" }, { status: 401 });

  const { allowed } = await rateLimit(`bookmark:${session.user.id}`, 60, 3600);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const post = await platformDb.select({ id: posts.id }).from(posts).where(eq(posts.id, id)).get();
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  await ensureProfile(session.user.id, session.user.name);

  const existing = await platformDb
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.postId, id), eq(bookmarks.userId, session.user.id)))
    .get();

  if (existing) {
    await platformDb
      .delete(bookmarks)
      .where(and(eq(bookmarks.postId, id), eq(bookmarks.userId, session.user.id)));
    return NextResponse.json({ bookmarked: false });
  }
  await platformDb.insert(bookmarks).values({
    postId: id,
    userId: session.user.id,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ bookmarked: true });
}
