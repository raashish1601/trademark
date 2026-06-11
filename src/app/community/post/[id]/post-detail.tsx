"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CommentSection, PostCard, usePost } from "@/features/community";

export function PostDetail({ id }: { id: string }) {
  const { data, isLoading, isError } = usePost(id);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link href="/community" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to community
      </Link>
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : isError || !data ? (
        <p className="py-16 text-center text-sm text-muted">This post doesn&apos;t exist (or was deleted).</p>
      ) : (
        <div className="space-y-6">
          <PostCard post={data.post} detail />
          <CommentSection postId={id} comments={data.comments} />
        </div>
      )}
    </div>
  );
}
