import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { platformDb } from "@/server/db/platform";
import { posts, profiles } from "@/server/db/platform-schema";
import { getSession, queryFeed } from "@/server/community";

/** Public profile + their posts. */
export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const session = await getSession();

  const profile = await platformDb
    .select()
    .from(profiles)
    .where(eq(profiles.username, username.toLowerCase()))
    .get();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const url = new URL(req.url);
  const [{ posts: userPosts, nextCursor }, countRow] = await Promise.all([
    queryFeed(
      { sort: "latest", cursor: url.searchParams.get("cursor"), tag: null, authorUserId: profile.userId },
      session?.user.id ?? null
    ),
    platformDb
      .select({ count: sql<number>`COUNT(*)` })
      .from(posts)
      .where(eq(posts.userId, profile.userId))
      .get(),
  ]);

  return NextResponse.json({
    profile: {
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      createdAt: profile.createdAt,
      postCount: Number(countRow?.count ?? 0),
      mine: session?.user.id === profile.userId,
    },
    posts: userPosts,
    nextCursor,
  });
}
