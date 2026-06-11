import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { platformDb } from "@/server/db/platform";
import { blogSubmissions } from "@/server/db/platform-schema";
import { getSession } from "@/server/community";
import { isAdmin } from "@/server/blog";
import { isAllowedOrigin } from "@/server/origin-check";
import { reviewBlogSchema } from "@/features/blog/schemas";

/** Admin: approve or reject a submission. Approving revalidates the blog. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const session = await getSession();
  if (!isAdmin(session?.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const parsed = reviewBlogSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const row = await platformDb.select().from(blogSubmissions).where(eq(blogSubmissions.id, id)).get();
  if (!row) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const status = parsed.data.action === "approve" ? "approved" : "rejected";
  await platformDb
    .update(blogSubmissions)
    .set({ status, reviewerNote: parsed.data.note ?? null, reviewedAt: new Date().toISOString() })
    .where(eq(blogSubmissions.id, id));

  // Invalidate the ISR cache so approved posts appear immediately.
  if (status === "approved") {
    revalidatePath("/blog");
    revalidatePath(`/blog/${row.slug}`);
  }
  return NextResponse.json({ status });
}
