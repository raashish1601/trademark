import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { platformDb } from "@/server/db/platform";
import { userDatabases } from "@/server/db/platform-schema";
import { hasTursoApi } from "@/server/env";
import { isAdmin } from "@/server/blog";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await platformDb
    .select()
    .from(userDatabases)
    .where(eq(userDatabases.userId, session.user.id))
    .get();

  return NextResponse.json({
    hostedConfigured: hasTursoApi(),
    provisioned: Boolean(row),
    dbName: row?.dbName ?? null,
    storageMode: row?.storageMode ?? null,
    status: row?.status ?? null,
    isAdmin: isAdmin(session.user.email),
    user: { id: session.user.id, email: session.user.email, name: session.user.name },
  });
}
