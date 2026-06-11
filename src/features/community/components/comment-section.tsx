"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, useAddComment, useDeleteComment } from "../api";
import type { CommentView } from "../types";
import { CommunityAvatar } from "./avatar";
import { SignInGate } from "./sign-in-gate";

export function CommentSection({ postId, comments }: { postId: string; comments: CommentView[] }) {
  const addComment = useAddComment(postId);
  const deleteComment = useDeleteComment(postId);
  const [body, setBody] = React.useState("");
  const [gateOpen, setGateOpen] = React.useState(false);

  const submit = async () => {
    if (!body.trim()) return;
    try {
      await addComment.mutateAsync(body.trim());
      setBody("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setGateOpen(true);
        return;
      }
      toast.error(e instanceof Error ? e.message : "Could not comment");
    }
  };

  return (
    <section aria-label="Comments" className="space-y-4">
      <h2 className="text-sm font-semibold">
        {comments.length === 0 ? "Comments" : `${comments.length} comment${comments.length > 1 ? "s" : ""}`}
      </h2>

      <div className="space-y-2">
        <Textarea
          rows={2}
          maxLength={2000}
          placeholder="Add your take…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label="Write a comment"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={addComment.isPending || !body.trim()} aria-busy={addComment.isPending}>
            {addComment.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Comment
          </Button>
        </div>
      </div>

      {comments.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">Be the first to comment.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Link href={`/community/u/${c.author.username}`} aria-label={`${c.author.displayName}'s profile`}>
                <CommunityAvatar size="sm" username={c.author.username} displayName={c.author.displayName} />
              </Link>
              <div className="min-w-0 flex-1 rounded-lg bg-surface-2/50 px-3 py-2">
                <p className="text-xs text-muted">
                  <Link href={`/community/u/${c.author.username}`} className="font-medium text-foreground hover:underline">
                    {c.author.displayName}
                  </Link>{" "}
                  · <time dateTime={c.createdAt}>{timeAgo(c.createdAt)}</time>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6">{c.body}</p>
              </div>
              {c.mine && (
                <button
                  aria-label="Delete comment"
                  onClick={() => confirm("Delete this comment?") && deleteComment.mutate(c.id)}
                  className="self-start rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-loss"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <SignInGate open={gateOpen} onOpenChange={setGateOpen} />
    </section>
  );
}
