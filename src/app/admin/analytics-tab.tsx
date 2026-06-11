"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";

export interface AdminOverview {
  stats: {
    totalUsers: number; newUsers7d: number; hostedDbs: number; byodUsers: number;
    totalPosts: number; posts7d: number; totalComments: number; totalLikes: number;
    blogPending: number; feedbackCount: number; activeUsers7d: number; views7d: number;
  };
  recentUsers: { email: string; name: string; createdAt: number }[];
  topPages: { path: string; views: number }[];
  dailyViews: { day: string; views: number }[];
  feedback: { id: string; category: string; message: string; email: string | null; path: string | null; createdAt: string }[];
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/overview");
      if (!res.ok) throw new Error("Failed to load analytics");
      return (await res.json()) as AdminOverview;
    },
  });
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="micro-label">{label}</p>
      <p className="mt-1 font-money text-2xl font-bold">{value.toLocaleString("en-IN")}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

/** Whole-platform analytics from first-party data (page_events + platform tables). */
export function AnalyticsTab() {
  const { data, isLoading, isError } = useAdminOverview();
  if (isLoading) return <Skeleton className="h-72 rounded-xl" />;
  if (isError || !data) return <p className="py-10 text-center text-sm text-loss">Could not load analytics.</p>;

  const { stats } = data;
  const maxViews = Math.max(1, ...data.dailyViews.map((d) => d.views));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total users" value={stats.totalUsers} sub={`+${stats.newUsers7d} this week`} />
        <Stat label="Active users · 7d" value={stats.activeUsers7d} sub="signed-in, visited" />
        <Stat label="Page views · 7d" value={stats.views7d} />
        <Stat label="Hosted / BYOD" value={stats.hostedDbs} sub={`${stats.byodUsers} on their own DB`} />
        <Stat label="Community posts" value={stats.totalPosts} sub={`+${stats.posts7d} this week`} />
        <Stat label="Comments" value={stats.totalComments} />
        <Stat label="Likes" value={stats.totalLikes} />
        <Stat label="Blog pending" value={stats.blogPending} sub={`${stats.feedbackCount} feedback total`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Daily page views · 14d</CardTitle></CardHeader>
          <CardContent>
            {data.dailyViews.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">No views recorded yet.</p>
            ) : (
              <div className="flex h-32 items-end gap-1" role="img" aria-label="Daily page views bar chart">
                {data.dailyViews.map((d) => (
                  <div key={d.day} className="group relative flex-1">
                    <div
                      className="w-full rounded-t bg-accent/70 transition-colors group-hover:bg-accent"
                      style={{ height: `${Math.max(4, (d.views / maxViews) * 120)}px` }}
                      title={`${d.day}: ${d.views} views`}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top pages · 7d</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {data.topPages.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">No views recorded yet.</p>
            ) : (
              data.topPages.map((p) => (
                <div key={p.path} className="flex items-center justify-between text-sm">
                  <span className="truncate font-mono text-xs">{p.path}</span>
                  <span className="font-money text-muted">{p.views}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent signups</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {data.recentUsers.map((u) => (
            <div key={u.email} className="flex items-center justify-between py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{u.name}</p>
                <p className="truncate text-xs text-muted">{u.email}</p>
              </div>
              <time className="shrink-0 text-xs text-muted" dateTime={new Date(u.createdAt * 1000).toISOString()}>
                {timeAgo(new Date(u.createdAt * 1000).toISOString())} ago
              </time>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
