"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flag, Heart, Link2, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn, timeAgo } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError, useDeletePost, useReport, useToggleLike } from "../api";
import type { PostView } from "../types";
import { CommunityAvatar } from "./avatar";
import { TradeCardView } from "./trade-card-view";
import { SignInGate } from "./sign-in-gate";

export function PostCard({ post, detail = false }: { post: PostView; detail?: boolean }) {
  const router = useRouter();
  const toggleLike = useToggleLike();
  const deletePost = useDeletePost();
  const report = useReport();
  const [gateOpen, setGateOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(detail);
  const pendingAction = React.useRef<(() => void) | null>(null);

  // Attempt the action; only raise the gate if the server says 401. After auth,
  // the pending action retries (cookie is set), so no session pre-check is needed.
  const onUnauthorized = (retry: () => void) => {
    pendingAction.current = retry;
    setGateOpen(true);
  };
  const like = () =>
    toggleLike.mutate(post.id, {
      onError: (e) => e instanceof ApiError && e.status === 401 && onUnauthorized(like),
    });
  const doReport = () =>
    report.mutate(
      { targetType: "post", targetId: post.id },
      {
        onSuccess: () => toast.success("Reported — thank you"),
        onError: (e) =>
          e instanceof ApiError && e.status === 401
            ? onUnauthorized(doReport)
            : toast.error("Could not report"),
      }
    );

  const longBody = post.body.length > 420;
  const body = expanded || !longBody ? post.body : post.body.slice(0, 400).trimEnd() + "…";

  const copyLink = () => {
    void navigator.clipboard.writeText(`${location.origin}/community/post/${post.id}`);
    toast.success("Link copied");
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post?")) return;
    await deletePost.mutateAsync(post.id);
    toast.success("Post deleted");
    if (detail) router.replace("/community");
  };

  return (
    <article className="rounded-xl border bg-surface p-4 transition-colors hover:border-border/80">
      <header className="flex items-center gap-2.5">
        <Link href={`/community/u/${post.author.username}`} aria-label={`${post.author.displayName}'s profile`}>
          <CommunityAvatar username={post.author.username} displayName={post.author.displayName} />
        </Link>
        <div className="min-w-0 leading-tight">
          <Link href={`/community/u/${post.author.username}`} className="text-sm font-semibold hover:underline">
            {post.author.displayName}
          </Link>
          <p className="text-xs text-muted">
            <Link href={`/community/u/${post.author.username}`} className="hover:text-accent">
              @{post.author.username}
            </Link>
            {" · "}
            <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Post options"
            className="ml-auto rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <span aria-hidden>⋯</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={copyLink}>
              <Link2 /> Copy link
            </DropdownMenuItem>
            {post.mine ? (
              <DropdownMenuItem onClick={handleDelete} className="text-loss">
                <Trash2 /> Delete post
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={doReport}>
                <Flag /> Report
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="mt-3">
        {post.title && (
          <h2 className="text-base font-semibold leading-snug">
            {detail ? post.title : <Link href={`/community/post/${post.id}`} className="hover:text-accent">{post.title}</Link>}
          </h2>
        )}
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{body}</p>
        {longBody && !expanded && (
          <button className="mt-1 text-xs font-medium text-accent hover:underline" onClick={() => setExpanded(true)}>
            Show more
          </button>
        )}
      </div>

      {post.tradeCard && <TradeCardView card={post.tradeCard} />}

      {post.images.length > 0 && (
        <div className={cn("mt-3 grid gap-2", post.images.length > 1 && "grid-cols-2")}>
          {post.images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={`Chart shared by ${post.author.displayName}`} className="w-full rounded-lg border" loading="lazy" />
          ))}
        </div>
      )}

      {post.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <Link
              key={t}
              href={`/community?tag=${encodeURIComponent(t)}`}
              className="rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/20"
            >
              #{t}
            </Link>
          ))}
        </div>
      )}

      <footer className="mt-3 flex items-center gap-1 border-t pt-2">
        <button
          aria-label={post.likedByMe ? "Unlike" : "Like"}
          aria-pressed={post.likedByMe}
          onClick={like}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            post.likedByMe ? "text-loss" : "text-muted hover:bg-surface-2 hover:text-foreground"
          )}
        >
          <Heart className={cn("h-4 w-4", post.likedByMe && "fill-current")} aria-hidden />
          {post.likeCount > 0 && <span className="font-money">{post.likeCount}</span>}
        </button>
        <Link
          href={`/community/post/${post.id}`}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          aria-label={`${post.commentCount} comments`}
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {post.commentCount > 0 && <span className="font-money">{post.commentCount}</span>}
        </Link>
      </footer>

      <SignInGate
        open={gateOpen}
        onOpenChange={setGateOpen}
        onAuthed={() => {
          pendingAction.current?.();
          pendingAction.current = null;
        }}
      />
    </article>
  );
}
