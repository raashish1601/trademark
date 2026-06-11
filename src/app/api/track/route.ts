import { NextResponse } from "next/server";
import { newId } from "@/lib/id";
import { platformDb } from "@/server/db/platform";
import { pageEvents } from "@/server/db/platform-schema";
import { getSession } from "@/server/community";
import { isAllowedOrigin } from "@/server/origin-check";

/**
 * First-party page-view tracking for the admin analytics dashboard.
 * Stores only path + (optional) user id + timestamp — no IP, no fingerprinting.
 */
export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { path?: string } | null;
  const path = body?.path;
  if (!path || typeof path !== "string" || path.length > 200) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const session = await getSession().catch(() => null);
  await platformDb
    .insert(pageEvents)
    .values({
      id: newId(),
      // Normalize dynamic segments so analytics aggregate cleanly.
      path: path.replace(/\/(post|u)\/[^/]+$/, "/$1/*").replace(/\/trades\/[^/]+$/, "/trades/*"),
      userId: session?.user.id ?? null,
      createdAt: new Date().toISOString(),
    })
    .catch(() => undefined); // analytics must never break the app
  return NextResponse.json({ ok: true });
}
