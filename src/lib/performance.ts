export type PerformanceMetrics = {
  reach: number | null;
  impressions: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
};

export function getInteractions(metrics: Pick<PerformanceMetrics, "likes" | "comments" | "shares" | "saves">) {
  return (metrics.likes ?? 0) + (metrics.comments ?? 0) + (metrics.shares ?? 0) + (metrics.saves ?? 0);
}

export function getEngagementRateByReach(metrics: PerformanceMetrics): number | null {
  if (metrics.reach === null || metrics.reach === 0 || [metrics.likes, metrics.comments, metrics.shares, metrics.saves].every(value => value === null)) return null;
  return Number((getInteractions(metrics) / metrics.reach * 100).toFixed(2));
}
