import PerformancePage from "@/app/performance/page";

export const instant = false;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return PerformancePage({ searchParams: Promise.resolve({ ...params, surface: "reports", tab: typeof params.tab === "string" ? params.tab : "monthly" }) });
}
