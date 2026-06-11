"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredMode } from "@/lib/db/byod-store";

/**
 * Landing-page only: users who already have a journal connected (any storage
 * mode — hosted session, BYOD creds, or local) land straight on their dashboard
 * instead of the marketing page.
 */
export function ReturningUserRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (getStoredMode()) router.replace("/app/dashboard");
  }, [router]);
  return null;
}
