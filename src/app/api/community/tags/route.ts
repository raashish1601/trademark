import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { platformDb } from "@/server/db/platform";

/** Trending topics — tag usage counts over the last 7 days (SQLite json_each). */
export async function GET() {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  try {
    const rows = await platformDb.all(
      sql`SELECT je.value AS tag, COUNT(*) AS count
          FROM posts, json_each(posts.tags) AS je
          WHERE posts.created_at >= ${since} AND posts.tags IS NOT NULL
          GROUP BY je.value ORDER BY count DESC LIMIT 8`
    );
    return NextResponse.json({ tags: rows });
  } catch {
    return NextResponse.json({ tags: [] });
  }
}
