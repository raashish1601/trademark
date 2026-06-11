import "server-only";
import { headers } from "next/headers";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { auth } from "./auth";
import { platformDb } from "./db/platform";
import { comments, likes, postImages, posts, profiles } from "./db/platform-schema";
import type { AuthorView, PostView, TradeCard } from "@/features/community/types";

const RESERVED_USERNAMES = new Set(["admin", "trademark", "api", "mod", "support", "system", "me"]);

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Gets-or-creates the user's public profile (auto-generates a unique handle). */
export async function ensureProfile(userId: string, name: string) {
  const existing = await platformDb.select().from(profiles).where(eq(profiles.userId, userId)).get();
  if (existing) return existing;

  const base =
    name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 14) ||
    "trader";
  for (let attempt = 0; attempt < 8; attempt++) {
    const suffix = attempt === 0 ? "" : `_${Math.floor(100 + Math.random() * 900)}`;
    const username = `${base}${suffix}`;
    if (RESERVED_USERNAMES.has(username)) continue;
    try {
      await platformDb.insert(profiles).values({
        userId,
        username,
        displayName: name || "Trader",
        createdAt: new Date().toISOString(),
      });
      return platformDb.select().from(profiles).where(eq(profiles.userId, userId)).get();
    } catch {
      /* username collision — retry with suffix */
    }
  }
  throw new Error("Could not allocate a username");
}

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username);
}

interface PostRow {
  id: string;
  userId: string;
  title: string | null;
  body: string;
  tradeCard: string | null;
  tags: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
}

const parseJson = <T,>(s: string | null): T | null => {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};

/** Hydrates post rows into client views (authors, images, likedByMe) in 3 queries. */
export async function hydratePosts(rows: PostRow[], viewerId: string | null): Promise<PostView[]> {
  if (rows.length === 0) return [];
  const postIds = rows.map((r) => r.id);
  const userIds = [...new Set(rows.map((r) => r.userId))];

  const [authors, images, myLikes] = await Promise.all([
    platformDb.select().from(profiles).where(inArray(profiles.userId, userIds)),
    platformDb
      .select()
      .from(postImages)
      .where(inArray(postImages.postId, postIds))
      .orderBy(postImages.position),
    viewerId
      ? platformDb
          .select({ postId: likes.postId })
          .from(likes)
          .where(and(eq(likes.userId, viewerId), inArray(likes.postId, postIds)))
      : Promise.resolve([] as { postId: string }[]),
  ]);

  const authorMap = new Map<string, AuthorView>(
    authors.map((a) => [a.userId, { username: a.username, displayName: a.displayName }])
  );
  const likedSet = new Set(myLikes.map((l) => l.postId));
  const imageMap = new Map<string, string[]>();
  for (const img of images) {
    const arr = imageMap.get(img.postId) ?? [];
    arr.push(img.data);
    imageMap.set(img.postId, arr);
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    tags: parseJson<string[]>(r.tags) ?? [],
    tradeCard: parseJson<TradeCard>(r.tradeCard),
    images: imageMap.get(r.id) ?? [],
    likeCount: r.likeCount,
    commentCount: r.commentCount,
    createdAt: r.createdAt,
    likedByMe: likedSet.has(r.id),
    mine: viewerId === r.userId,
    author: authorMap.get(r.userId) ?? { username: "deleted", displayName: "Deleted user" },
  }));
}

export interface FeedQuery {
  sort: "latest" | "top";
  cursor: string | null;
  tag: string | null;
  authorUserId?: string;
  limit?: number;
}

export async function queryFeed(q: FeedQuery, viewerId: string | null) {
  const limit = q.limit ?? 15;
  const conditions = [];
  if (q.authorUserId) conditions.push(eq(posts.userId, q.authorUserId));
  if (q.tag) conditions.push(sql`${posts.tags} LIKE ${`%"${q.tag}"%`}`);

  let rows: PostRow[];
  if (q.sort === "top") {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    conditions.push(sql`${posts.createdAt} >= ${since}`);
    rows = await platformDb
      .select()
      .from(posts)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(posts.likeCount), desc(posts.createdAt))
      .limit(limit + 1);
  } else {
    if (q.cursor) conditions.push(lt(posts.createdAt, q.cursor));
    rows = await platformDb
      .select()
      .from(posts)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1);
  }

  const page = rows.slice(0, limit);
  const nextCursor =
    q.sort === "latest" && rows.length > limit ? (page[page.length - 1]?.createdAt ?? null) : null;
  return { posts: await hydratePosts(page, viewerId), nextCursor };
}

export async function deletePostCascade(postId: string) {
  await platformDb.delete(comments).where(eq(comments.postId, postId));
  await platformDb.delete(likes).where(eq(likes.postId, postId));
  await platformDb.delete(postImages).where(eq(postImages.postId, postId));
  await platformDb.delete(posts).where(eq(posts.id, postId));
}
