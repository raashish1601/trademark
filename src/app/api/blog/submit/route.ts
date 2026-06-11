import { NextResponse } from "next/server";
import { newId } from "@/lib/id";
import { platformDb } from "@/server/db/platform";
import { blogSubmissions } from "@/server/db/platform-schema";
import { getSession } from "@/server/community";
import { isAllowedOrigin } from "@/server/origin-check";
import { rateLimit } from "@/server/rate-limit";
import { htmlToText, sanitizeRichHtml, slugify } from "@/server/blog";
import { submitBlogSchema } from "@/features/blog/schemas";

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to submit a post" }, { status: 401 });

  const { allowed } = await rateLimit(`blog-submit:${session.user.id}`, 3, 86400);
  if (!allowed) return NextResponse.json({ error: "Daily submission limit reached" }, { status: 429 });

  const parsed = submitBlogSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid submission" }, { status: 400 });
  }

  const cleanHtml = sanitizeRichHtml(parsed.data.contentHtml);
  if (htmlToText(cleanHtml).length < 40) {
    return NextResponse.json({ error: "Your article is too short after formatting" }, { status: 400 });
  }

  const id = newId();
  await platformDb.insert(blogSubmissions).values({
    id,
    authorId: session.user.id,
    title: parsed.data.title.trim(),
    slug: slugify(parsed.data.title),
    excerpt: parsed.data.excerpt.trim(),
    contentHtml: cleanHtml,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ id, status: "pending" }, { status: 201 });
}
