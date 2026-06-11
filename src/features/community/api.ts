"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import type { CommentView, FeedResponse, PostView, ProfileView } from "./types";
import type { CreatePostInput, UpdateProfileInput } from "./schemas";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data;
}

export type FeedSort = "latest" | "top";

export function useFeed(sort: FeedSort, tag: string | null) {
  return useInfiniteQuery({
    queryKey: ["community-feed", sort, tag],
    queryFn: ({ pageParam }) =>
      request<FeedResponse>(
        `/api/community/posts?sort=${sort}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""
        }`
      ),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: ["community-post", id],
    queryFn: () => request<{ post: PostView; comments: CommentView[] }>(`/api/community/posts/${id}`),
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) =>
      request<{ id: string }>("/api/community/posts", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-feed"] }),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request(`/api/community/posts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-feed"] }),
  });
}

/** Optimistic like toggle — patches every cached copy of the post immediately. */
export function useToggleLike() {
  const qc = useQueryClient();

  const patchPost = (post: PostView): PostView => ({
    ...post,
    likedByMe: !post.likedByMe,
    likeCount: post.likeCount + (post.likedByMe ? -1 : 1),
  });

  const patchEverywhere = (id: string) => {
    qc.setQueriesData<InfiniteData<FeedResponse>>({ queryKey: ["community-feed"] }, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((p) => ({
              ...p,
              posts: p.posts.map((post) => (post.id === id ? patchPost(post) : post)),
            })),
          }
        : data
    );
    qc.setQueryData<{ post: PostView; comments: CommentView[] }>(["community-post", id], (data) =>
      data ? { ...data, post: patchPost(data.post) } : data
    );
  };

  return useMutation({
    mutationFn: (id: string) =>
      request<{ liked: boolean; likeCount: number }>(`/api/community/posts/${id}/like`, {
        method: "POST",
      }),
    onMutate: (id) => patchEverywhere(id),
    onError: (_e, id) => patchEverywhere(id), // revert
  });
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      request<CommentView>(`/api/community/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: (comment) => {
      qc.setQueryData<{ post: PostView; comments: CommentView[] }>(
        ["community-post", postId],
        (data) =>
          data
            ? {
                post: { ...data.post, commentCount: data.post.commentCount + 1 },
                comments: [...data.comments, comment],
              }
            : data
      );
    },
  });
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      request(`/api/community/comments/${commentId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-post", postId] }),
  });
}

export function useMyProfile(enabled: boolean) {
  return useQuery({
    queryKey: ["community-me"],
    queryFn: () => request<{ username: string; displayName: string; bio: string | null }>("/api/community/profile"),
    enabled,
    retry: false,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      request("/api/community/profile", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useUserProfile(username: string) {
  return useQuery({
    queryKey: ["community-user", username],
    queryFn: () =>
      request<{ profile: ProfileView & { mine: boolean }; posts: PostView[]; nextCursor: string | null }>(
        `/api/community/users/${encodeURIComponent(username)}`
      ),
  });
}

export function useReport() {
  return useMutation({
    mutationFn: (input: { targetType: "post" | "comment"; targetId: string; reason?: string }) =>
      request("/api/community/report", { method: "POST", body: JSON.stringify(input) }),
  });
}
