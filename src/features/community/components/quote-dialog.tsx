"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ComposerTextarea } from "./composer-textarea";
import { QuotedPostCard } from "./quoted-post-card";
import { ApiError, useReshare } from "../api";
import type { PostView, QuotedPostView } from "../types";

/**
 * Quote-with-thoughts composer. Shows the original embedded as a preview and a
 * commentary textarea; posting creates a quote referencing the root original.
 * An empty body still posts (degrades to a plain reshare). The original preview
 * is built from the post being reshared (its own embedded original if it's a
 * reshare, else itself), matching how the server collapses to the root.
 */
export function QuoteDialog({
  post,
  open,
  onOpenChange,
  onUnauthorized,
}: {
  post: PostView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with a retry when the reshare 401s, so the card can gate sign-in. */
  onUnauthorized: (retry: () => void) => void;
}) {
  const router = useRouter();
  const reshare = useReshare();
  const [body, setBody] = React.useState("");

  // Preview the ROOT original — if the clicked post is itself a reshare we show
  // its embedded original (collapse to root), else the post itself.
  const preview: QuotedPostView =
    post.quoted && !post.quoted.unavailable
      ? post.quoted
      : {
          id: post.id,
          title: post.title,
          body: post.body.length > 280 ? post.body.slice(0, 280).trimEnd() + "…" : post.body,
          tradeCard: post.tradeCard,
          createdAt: post.createdAt,
          author: post.author,
          unavailable: false,
        };

  const submit = () => {
    const trimmed = body.trim();
    reshare.mutate(
      { targetId: post.id, body: trimmed || undefined },
      {
        onSuccess: (r) => {
          toast.success(r.quote ? "Quoted to the community" : "Reshared");
          setBody("");
          onOpenChange(false);
          router.push("/community");
        },
        onError: (e) => {
          if (e instanceof ApiError && e.status === 401) {
            onOpenChange(false);
            onUnauthorized(() => onOpenChange(true));
            return;
          }
          toast.error(e instanceof Error ? e.message : "Could not reshare");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat2 className="h-4 w-4" aria-hidden /> Reshare with your thoughts
          </DialogTitle>
          <DialogDescription>Add commentary, or leave it blank to reshare as-is.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <ComposerTextarea
            id="quote-body"
            aria-label="Your thoughts"
            rows={3}
            maxLength={5000}
            placeholder="Add your take… use @ to mention, $ for tickers, # for topics"
            value={body}
            onValueChange={setBody}
          />
          <QuotedPostCard quoted={preview} />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={reshare.isPending} aria-busy={reshare.isPending}>
              {reshare.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {body.trim() ? "Post quote" : "Reshare"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
