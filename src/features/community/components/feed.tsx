"use client";

import * as React from "react";
import { MessagesSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useFeed, type FeedSort } from "../api";
import { PostCard } from "./post-card";

export function Feed({ sort, tag, search = null }: { sort: FeedSort; tag: string | null; search?: string | null }) {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed(sort, tag, search);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage && void fetchNextPage(),
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading posts">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError) {
    return <p className="py-10 text-center text-sm text-loss">Could not load the feed — try refreshing.</p>;
  }

  const posts = data?.pages.flatMap((p) => p.posts) ?? [];
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title={search ? `No results for “${search}”` : tag ? `Nothing under #${tag} yet` : "No posts yet"}
        description={search ? "Try a different search." : "Be the first — share a trade idea, a lesson, or a question."}
      />
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <div ref={sentinelRef} aria-hidden />
      {isFetchingNextPage && <Skeleton className="h-44 rounded-xl" />}
      {!hasNextPage && posts.length > 5 && (
        <p className="py-6 text-center text-xs text-muted">You&apos;re all caught up 🎉</p>
      )}
    </div>
  );
}
