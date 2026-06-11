import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { newId } from "@/lib/id";
import { platformDb } from "@/server/db/platform";
import { comments, posts } from "@/server/db/platform-schema";
import { ensureProfile, getSession } from "@/server/community";
import { isAllowedOrigin } from "@/server/origin-check";
import { rateLimit } from "@/server/rate-limit";
import { createCommentSchema } from "@/features/community/schemas";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to comment" }, { status: 401 });

  const { allowed } = await rateLimit(`comment:${session.user.id}`, 20, 3600);
  if (!allowed) return NextResponse.json({ error: "Commenting too fast" }, { status: 429 });

  const parsed = createCommentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid comment" },
      { status: 400 }
    );
  }

  const post = await platformDb.select({ id: posts.id }).from(posts).where(eq(posts.id, id)).get();
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  const profile = await ensureProfile(session.user.id, session.user.name);

  const commentId = newId();
  await platformDb.insert(comments).values({
    id: commentId,
    postId: id,
    userId: session.user.id,
    body: parsed.data.body.trim(),
    createdAt: new Date().toISOString(),
  });
  await platformDb
    .update(posts)
    .set({ commentCount: sql`${posts.commentCount} + 1` })
    .where(eq(posts.id, id));

  return NextResponse.json(
    {
      id: commentId,
      body: parsed.data.body.trim(),
      createdAt: new Date().toISOString(),
      mine: true,
      author: { username: profile!.username, displayName: profile!.displayName },
    },
    { status: 201 }
  );
}
