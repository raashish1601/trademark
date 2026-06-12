"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useConversations } from "../api";

/** Header inbox button with unread badge — shown to signed-in community members. */
export function MessagesButton() {
  const { data: session } = useSession();
  const { data } = useConversations(Boolean(session), 30_000);
  if (!session) return null;

  const unread = data?.unread ?? 0;
  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <Link
        href="/community/messages"
        aria-label={`Messages${unread ? ` (${unread} unread)` : ""}`}
      >
        <MessageCircle className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-money text-[10px] font-bold text-accent-fg">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
