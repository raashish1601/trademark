"use client";

import Link from "next/link";
import { Ban } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import type { QuotedPostView } from "../types";
import { CommunityAvatar } from "./avatar";
import { TradeCardView } from "./trade-card-view";

/**
 * The original post embedded inside a reshare/quote — a compact, bordered card
 * (no images by design) that links to the original. When the original has been
 * deleted it renders a muted "post unavailable" placeholder instead of a link.
 */
export function QuotedPostCard({ quoted }: { quoted: QuotedPostView }) {
  if (quoted.unavailable) {
    return (
      <div
        data-quoted-unavailable
        className="mt-3 flex items-center gap-2 rounded-lg border border-dashed bg-surface-2/30 px-3 py-2.5 text-xs text-muted"
      >
        <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden />
        This post is no longer available.
      </div>
    );
  }

  return (
    <Link
      href={`/community/post/${quoted.id}`}
      data-quoted-post={quoted.id}
      className={cn(
        "mt-3 block rounded-lg border bg-surface-2/30 p-3 transition-colors hover:border-border/80 hover:bg-surface-2/50"
      )}
    >
      <div className="flex items-center gap-2">
        <CommunityAvatar
          size="sm"
          username={quoted.author.username}
          displayName={quoted.author.displayName}
          avatar={quoted.author.avatar}
        />
        <div className="min-w-0 leading-tight">
          <span className="text-xs font-semibold">{quoted.author.displayName}</span>
          <span className="ml-1 text-[11px] text-muted">@{quoted.author.username}</span>
          {quoted.createdAt && (
            <>
              <span className="px-1 text-[11px] text-muted">·</span>
              <time
                dateTime={quoted.createdAt}
                className="text-[11px] text-muted"
                suppressHydrationWarning
              >
                {timeAgo(quoted.createdAt)}
              </time>
            </>
          )}
        </div>
      </div>
      {quoted.title && <p className="mt-1.5 text-sm font-semibold leading-snug">{quoted.title}</p>}
      {quoted.body && (
        <p className="mt-1 whitespace-pre-wrap text-[13px] leading-6 text-foreground/90">
          {quoted.body}
        </p>
      )}
      {quoted.tradeCard && <TradeCardView card={quoted.tradeCard} />}
    </Link>
  );
}
