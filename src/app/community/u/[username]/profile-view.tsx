"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Pencil, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  CommunityAvatar,
  PostCard,
  SignInGate,
  useUpdateProfile,
  useUserProfile,
} from "@/features/community";
import { ApiError, useToggleFollow } from "@/features/community/api";

export function ProfileView({ username }: { username: string }) {
  const { data, isLoading, isError } = useUserProfile(username);
  const updateProfile = useUpdateProfile();
  const toggleFollow = useToggleFollow(username);
  const [editOpen, setEditOpen] = React.useState(false);
  const [gateOpen, setGateOpen] = React.useState(false);

  const follow = () =>
    toggleFollow.mutate(undefined, {
      onError: (e) =>
        e instanceof ApiError && e.status === 401
          ? setGateOpen(true)
          : toast.error("Could not follow"),
    });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    );
  }
  if (isError || !data) {
    return <p className="py-16 text-center text-sm text-muted">Profile not found.</p>;
  }
  const { profile, posts } = data;

  const saveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newUsername = String(form.get("username"));
    try {
      await updateProfile.mutateAsync({
        username: newUsername || undefined,
        displayName: String(form.get("displayName")) || undefined,
        bio: String(form.get("bio") ?? ""),
      });
      toast.success("Profile updated");
      setEditOpen(false);
      if (newUsername && newUsername !== profile.username) {
        location.assign(`/community/u/${newUsername}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profile");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link
        href="/community"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to community
      </Link>

      <header className="flex items-start gap-4 rounded-xl border bg-surface p-5">
        <CommunityAvatar size="lg" username={profile.username} displayName={profile.displayName} />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight">{profile.displayName}</h1>
          <p className="text-sm text-muted">@{profile.username}</p>
          {profile.bio && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{profile.bio}</p>
          )}
          <p className="mt-2 text-xs text-muted">
            <span className="font-medium text-foreground">{profile.followerCount}</span> followers ·{" "}
            <span className="font-medium text-foreground">{profile.followingCount}</span> following
            · {profile.postCount} post{profile.postCount === 1 ? "" : "s"} · joined{" "}
            <time dateTime={profile.createdAt}>{timeAgo(profile.createdAt)}</time> ago
          </p>
        </div>
        {data.profile.mine ? (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
          </Button>
        ) : (
          <Button
            variant={profile.followedByMe ? "outline" : "default"}
            size="sm"
            onClick={follow}
            disabled={toggleFollow.isPending}
            aria-pressed={profile.followedByMe}
          >
            {profile.followedByMe ? (
              <>
                <UserCheck className="h-3.5 w-3.5" aria-hidden /> Following
              </>
            ) : (
              <>
                <UserPlus className="h-3.5 w-3.5" aria-hidden /> Follow
              </>
            )}
          </Button>
        )}
      </header>

      <section aria-label={`Posts by ${profile.displayName}`} className="mt-5 space-y-3">
        {posts.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No posts yet.</p>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </section>

      <SignInGate open={gateOpen} onOpenChange={setGateOpen} onAuthed={follow} />
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={saveProfile}>
            <div className="space-y-1.5">
              <Label htmlFor="pf-name">Display name</Label>
              <Input
                id="pf-name"
                name="displayName"
                defaultValue={profile.displayName}
                maxLength={40}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-username">Username</Label>
              <Input
                id="pf-username"
                name="username"
                defaultValue={profile.username}
                pattern="[a-z0-9_]{3,20}"
                title="3–20 characters: a-z, 0-9, underscore"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-bio">Bio</Label>
              <Textarea
                id="pf-bio"
                name="bio"
                defaultValue={profile.bio ?? ""}
                maxLength={280}
                rows={3}
                placeholder="Index options scalper · 3 years in the market"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={updateProfile.isPending}
              aria-busy={updateProfile.isPending}
            >
              {updateProfile.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Save profile
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
