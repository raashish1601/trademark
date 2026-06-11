import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/server/auth";
import { isAdmin } from "@/server/blog";
import { Logo } from "@/components/shared/logo";
import { QueryProvider } from "@/providers/query-provider";
import { AdminPanel } from "./admin-panel";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/app/onboarding");
  if (!isAdmin(session.user.email)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-lg font-semibold">Not authorized</h1>
        <p className="text-sm text-muted">This area is restricted to administrators.</p>
        <Link href="/" className="mt-2 text-sm text-accent hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center gap-2 px-4">
          <Logo />
          <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted">Admin</span>
          <span className="ml-auto text-xs text-muted">{session.user.email}</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <QueryProvider>
          <AdminPanel />
        </QueryProvider>
      </main>
    </div>
  );
}
