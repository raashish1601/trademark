import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { platformDb } from "@/server/db/platform";
import { blocks, follows, profiles } from "@/server/db/platform-schema";
import { ensureProfile, getSession } from "@/server/community";
import { isAllowedOrigin } from "@/server/origin-check";
import { rateLimit } from "@/server/rate-limit";

/** Toggles blocking a user. Blocking also removes any follow relationship. */
export async function POST(req: Request, ctx: { params: Promise<{ username: string }> }) {
  if (!isAllowedOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { username } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { allowed } = await rateLimit(`block:${session.user.id}`, 20, 3600);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const target = await platformDb
    .select()
    .from(profiles)
    .where(eq(profiles.username, username.toLowerCase()))
    .get();
  if (!target) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (target.userId === session.user.id)
    return NextResponse.json({ error: "You can't block yourself" }, { status: 400 });
  await ensureProfile(session.user.id, session.user.name);

  const existing = await platformDb
    .select()
    .from(blocks)
    .where(and(eq(blocks.blockerId, session.user.id), eq(blocks.blockedId, target.userId)))
    .get();

  if (existing) {
    await platformDb
      .delete(blocks)
      .where(and(eq(blocks.blockerId, session.user.id), eq(blocks.blockedId, target.userId)));
    return NextResponse.json({ blocked: false });
  }
  await platformDb.insert(blocks).values({
    blockerId: session.user.id,
    blockedId: target.userId,
    createdAt: new Date().toISOString(),
  });
  // Unfollow both directions — blocked users shouldn't stay in feeds.
  await platformDb
    .delete(follows)
    .where(and(eq(follows.followerId, session.user.id), eq(follows.followingId, target.userId)));
  await platformDb
    .delete(follows)
    .where(and(eq(follows.followerId, target.userId), eq(follows.followingId, session.user.id)));
  return NextResponse.json({ blocked: true });
}
