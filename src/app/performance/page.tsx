import Link from "next/link";
import { Button, EmptyState, Input, Select, Textarea } from "@/components/ui";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";
import { getEngagementRateByReach, getInteractions } from "@/lib/performance";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SetupNotice } from "@/components/setup-notice";
import { createMonthlyReportAction, createSocialReportAction, finalizeMonthlyReportAction, finalizeSocialReportAction, queueReportPdfAction, savePerformanceAction, updateMonthlyReportAction, updateSocialReportAction } from "@/app/actions/operational-actions";

type Params = Record<string, string | string[] | undefined>;
const number = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("en").format(value);
const statuses = { todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done" } as const;
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== value ? "" : value;
}
function jakartaDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function performancePageHref(page: number, filters: { clientId: string; platform: string; contentType: string; start: string; end: string; search: string }) {
  const query = new URLSearchParams({ tab: "performance", page: String(page) });
  if (filters.clientId) query.set("client_id", filters.clientId);
  if (filters.platform) query.set("platform", filters.platform);
  if (filters.contentType) query.set("content_type", filters.contentType);
  if (filters.start) query.set("period_start", filters.start);
  if (filters.end) query.set("period_end", filters.end);
  if (filters.search) query.set("q", filters.search);
  return `/performance?${query.toString()}`;
}

type TrendRow = { content_schedule_id: string; measured_at: string; reach: number | null; impressions: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null };
function buildTrendSeries(rows: TrendRow[], schedules: Map<string, { published_at: string | null }>) {
  const latest = new Map<string, TrendRow>();
  for (const row of rows) if (!latest.has(row.content_schedule_id)) latest.set(row.content_schedule_id, row);
  const grouped = new Map<string, { reach: number; impressions: number; interactions: number; hasReach: boolean; hasImpressions: boolean; hasInteractions: boolean }>();
  for (const row of latest.values()) {
    const publishedAt = schedules.get(row.content_schedule_id)?.published_at;
    if (!publishedAt) continue;
    const date = jakartaDate(publishedAt);
    const group = grouped.get(date) ?? { reach: 0, impressions: 0, interactions: 0, hasReach: false, hasImpressions: false, hasInteractions: false };
    if (row.reach != null) { group.reach += row.reach; group.hasReach = true; }
    if (row.impressions != null) { group.impressions += row.impressions; group.hasImpressions = true; }
    if ([row.likes, row.comments, row.shares, row.saves].some(value => value != null)) { group.interactions += getInteractions(row); group.hasInteractions = true; }
    grouped.set(date, group);
  }
  const dates = [...grouped.keys()].sort();
  return [
    { label: "Reach", points: dates.flatMap(date => grouped.get(date)!.hasReach ? [{ date, value: grouped.get(date)!.reach }] : []) },
    { label: "Impressions", points: dates.flatMap(date => grouped.get(date)!.hasImpressions ? [{ date, value: grouped.get(date)!.impressions }] : []) },
    { label: "Engagement", points: dates.flatMap(date => grouped.get(date)!.hasInteractions ? [{ date, value: grouped.get(date)!.interactions }] : []) },
  ];
}

function TrendChart({ points, label }: { points: Array<{ date: string; value: number }>; label: string }) {
  const width = 520, height = 120, pad = 18;
  const max = Math.max(1, ...points.map(point => point.value));
  const coords = points.map((point, index) => `${pad + (points.length === 1 ? 0 : index / (points.length - 1) * (width - pad * 2))},${height - pad - point.value / max * (height - pad * 2)}`);
  return <figure className="trend-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} by publication date`}><line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} /><polyline points={coords.join(" ")} />{points.map((point, index) => <circle key={point.date} cx={coords[index].split(",")[0]} cy={coords[index].split(",")[1]} r="3"><title>{point.date}: {number(point.value)}</title></circle>)}</svg><figcaption><span>{points[0]?.date}</span><span>Actual published performance · {points.length} dated points</span><span>{points.at(-1)?.date}</span></figcaption></figure>;
}

export default async function PerformancePage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) return <SetupNotice />;
  const params = await searchParams;
  const param = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const surface = param("surface") === "reports" ? "reports" : "performance";
  const basePath = surface === "reports" ? "/reports" : "/performance";
  const tab = ["performance", "monthly", "social"].includes(param("tab")) ? param("tab") : surface === "reports" ? "monthly" : "performance";
  const clientId = param("client_id");
  const platform = param("platform");
  const contentType = param("content_type");
  const reportStatus = param("report_status");
  const search = param("q").slice(0, 100).replace(/[%,()]/g, " ").trim();
  const performancePage = Math.max(1, Math.min(5000, Number(param("page")) || 1));
  const start = validDate(param("period_start"));
  const end = validDate(param("period_end"));
  const endExclusive = end ? new Date(new Date(`${end}T00:00:00+07:00`).getTime() + 86400000).toISOString() : "";
  const [{ data: clients }, { data: contentTypes }, { data: agencyMembers }] = await Promise.all([
    ctx.supabase.from("clients").select("id,brand_name").order("brand_name").limit(100),
    ctx.supabase.from("contents").select("content_type").order("content_type").limit(100),
    ctx.supabase.from("agency_members").select("id,full_name").eq("is_active", true).order("full_name").limit(200),
  ]);
  const clientNames = new Map((clients ?? []).map(c => [c.id, c.brand_name]));
  const memberNames = new Map((agencyMembers ?? []).map(member => [member.id, member.full_name]));

  const loadSchedulePage = (from: number, to: number) => {
    let query = ctx.supabase.from("content_schedules").select("id,content_id,client_id,platform,scheduled_at,published_at,post_url,publication_status,contents!inner(title,content_type)").eq("publication_status", "published").order("published_at", { ascending: false }).range(from, to);
    if (clientId) query = query.eq("client_id", clientId);
    if (platform) query = query.eq("platform", platform);
    if (contentType) query = query.eq("contents.content_type", contentType);
    if (search) query = query.ilike("contents.title", `%${search}%`);
    if (start) query = query.gte("published_at", `${start}T00:00:00+07:00`);
    if (end) query = query.lt("published_at", endExclusive);
    return query;
  };
  const schedules: Array<Awaited<ReturnType<typeof loadSchedulePage>>["data"] extends (infer Row)[] | null ? Row : never> = [];
  let scheduleError: Awaited<ReturnType<typeof loadSchedulePage>>["error"] = null;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await loadSchedulePage(from, from + 999);
    if (error) {
      scheduleError = error;
      break;
    }
    schedules.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const scheduleIds = schedules.map(s => s.id);
  const { data: performanceRows, error: performanceError, count: performanceCount } = scheduleIds.length
    ? await ctx.supabase.from("performances").select("*", { count: "exact" }).in("content_schedule_id", scheduleIds).order("measured_at", { ascending: false }).range((performancePage - 1) * 20, performancePage * 20 - 1)
    : { data: [], error: null, count: 0 };
  const { data: summary, error: summaryError } = await ctx.supabase.rpc("get_performance_summary", {
    p_client_id: clientId || null, p_platform: platform || null, p_period_start: start || null, p_period_end: end || null, p_content_type: contentType || null,
  });
  const scheduleMap = new Map(schedules.map(s => [s.id, s]));
  const engagementRate = (summary as { engagement_rate_by_reach?: number | null } | null)?.engagement_rate_by_reach ?? null;
  const activeReportId = param(tab === "monthly" ? "monthlyReport" : "socialReport");

  const reportTable = tab === "monthly" ? "monthly_reports" : "social_reports";
  let reportQuery = ctx.supabase.from(reportTable).select("*").order("updated_at", { ascending: false }).limit(50);
  if (tab !== "performance" && clientId) reportQuery = reportQuery.eq("client_id", clientId);
  if (tab !== "performance" && start) reportQuery = reportQuery.gte("period_start", start);
  if (tab !== "performance" && end) reportQuery = reportQuery.lte("period_end", end);
  const { data: reports, error: reportsError } = tab === "performance" ? { data: [], error: null } : await reportQuery;
  const monthlyIds = tab === "monthly" ? (reports ?? []).map(r => r.id) : [];
  const socialIds = tab === "social" ? (reports ?? []).map(r => r.id) : [];
  const [{ data: monthlyVersions }, { data: socialVersions }, { data: pdfJobs }] = await Promise.all([
    monthlyIds.length ? ctx.supabase.from("monthly_report_versions").select("id,monthly_report_id,version_number,finalized_at,finalized_by,snapshot_hash").in("monthly_report_id", monthlyIds).order("version_number", { ascending: false }) : { data: [] },
    socialIds.length ? ctx.supabase.from("social_report_versions").select("id,social_report_id,version_number,finalized_at,finalized_by,snapshot_hash").in("social_report_id", socialIds).order("version_number", { ascending: false }) : { data: [] },
    ctx.supabase.from("report_pdf_jobs").select("id,report_type,monthly_report_version_id,social_report_version_id,status,file_path,last_error,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const newestMonthly = new Map<string, NonNullable<typeof monthlyVersions>[number]>();
  for (const version of monthlyVersions ?? []) if (!newestMonthly.has(version.monthly_report_id)) newestMonthly.set(version.monthly_report_id, version);
  const newestSocial = new Map<string, NonNullable<typeof socialVersions>[number]>();
  for (const version of socialVersions ?? []) if (!newestSocial.has(version.social_report_id)) newestSocial.set(version.social_report_id, version);
  const activeReport = (reports ?? []).find(report => report.id === activeReportId) as Record<string, unknown> | undefined;
  const reportVersionsForTab = tab === "monthly" ? newestMonthly : newestSocial;
  const visibleReports = (reports ?? []).filter(report => (!search || `${clientNames.get(String(report.client_id)) ?? ""} ${String(report.platform ?? "")}`.toLowerCase().includes(search.toLowerCase())) && (!reportStatus || (reportStatus === "finalized" ? reportVersionsForTab.has(String(report.id)) : !reportVersionsForTab.has(String(report.id)))));
  const activeMonthly = tab === "monthly" ? activeReport as { id: string; client_id: string; period_start: string; period_end: string; work_summary: string; evaluation: string; challenges: string; next_plan: string; latest_version: number } | undefined : undefined;
  const activeSocial = tab === "social" ? activeReport as { id: string; client_id: string; platform: string; account_label: string; period_start: string; period_end: string; summary: string; evaluation: string; next_plan: string; latest_version: number } | undefined : undefined;
  const selectedSocialIds = new Set<string>();
  let socialPreviewRows: Array<{ performance: NonNullable<typeof performanceRows>[number]; schedule: NonNullable<typeof schedules>[number] }> = [];
  if (activeSocial) {
    const { data: items } = await ctx.supabase.from("social_report_items").select("performance_id").eq("social_report_id", activeSocial.id);
    for (const item of items ?? []) selectedSocialIds.add(item.performance_id);
    const { data: selectedPerformance } = selectedSocialIds.size ? await ctx.supabase.from("performances").select("*").in("id", [...selectedSocialIds]) : { data: [] };
    const previewScheduleIds = [...new Set((selectedPerformance ?? []).map(p => p.content_schedule_id))];
    const { data: previewSchedules } = previewScheduleIds.length ? await ctx.supabase.from("content_schedules").select("id,content_id,client_id,platform,scheduled_at,published_at,post_url,publication_status,contents!inner(title,content_type)").in("id",previewScheduleIds) : { data: [] };
    const previewMap = new Map((previewSchedules ?? []).map(s=>[s.id,s]));
    socialPreviewRows = (selectedPerformance ?? []).flatMap(p => { const schedule=previewMap.get(p.content_schedule_id);if(!schedule||schedule.platform!==activeSocial.platform||schedule.publication_status!=="published"||!schedule.published_at||jakartaDate(schedule.published_at)<activeSocial.period_start||jakartaDate(schedule.published_at)>activeSocial.period_end)return[];return[{performance:p,schedule}];});
  }
  let monthlyPreview: { contentCount: number; tasks: Array<{ id: string; title: string; status: string; priority: string; due_date: string | null }> } | null = null;
  if (activeMonthly) {
    const monthlyEndExclusive = new Date(new Date(`${activeMonthly.period_end}T00:00:00+07:00`).getTime() + 86400000).toISOString();
    const [{ count: contentCount }, { data: monthlyTasks }] = await Promise.all([
      ctx.supabase.from("contents").select("id", { count: "exact", head: true }).eq("client_id", activeMonthly.client_id).gte("created_at", `${activeMonthly.period_start}T00:00:00+07:00`).lt("created_at", monthlyEndExclusive),
      ctx.supabase.from("tasks").select("id,title,status,priority,due_date").eq("client_id", activeMonthly.client_id).is("archived_at", null).gte("due_date", activeMonthly.period_start).lte("due_date", activeMonthly.period_end).order("due_date").limit(100),
    ]);
    monthlyPreview = { contentCount: contentCount ?? 0, tasks: monthlyTasks ?? [] };
  }
  const updatedMonthly = activeMonthly ? updateMonthlyReportAction.bind(null, activeMonthly.id) : null;
  const updatedSocial = activeSocial ? updateSocialReportAction.bind(null, activeSocial.id) : null;
  const versionId = param("version");
  let frozenSnapshot: { version_number: number; snapshot_hash: string; snapshot_data: Record<string, unknown> } | null = null;
  if (versionId) {
    const versionQuery = tab === "monthly"
      ? await ctx.supabase.from("monthly_report_versions").select("version_number,snapshot_hash,snapshot_data").eq("id",versionId).maybeSingle()
      : await ctx.supabase.from("social_report_versions").select("version_number,snapshot_hash,snapshot_data").eq("id",versionId).maybeSingle();
    frozenSnapshot = versionQuery.data as typeof frozenSnapshot;
  }

  return <WorkspaceShell title={surface === "reports" ? "Reports & Recap" : "Performance Insights"} section={`Growth & Insights / ${surface === "reports" ? "Reports & Recap" : "Performance Insights"}`} memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <div className="workspace-section">
      <nav className="workspace-tabs" aria-label="Insights sections">
        <Link href="/performance?tab=performance" aria-current={surface === "performance" ? "page" : undefined}>Performance</Link>
        <Link href="/reports?tab=monthly" aria-current={surface === "reports" ? "page" : undefined}>Reports</Link>
      </nav>
      {frozenSnapshot && <SnapshotPreview snapshot={frozenSnapshot} />}

      {surface === "reports" && <nav className="workspace-tabs report-tabs" aria-label="Report types"><Link href="/reports?tab=monthly" aria-current={tab === "monthly" ? "page" : undefined}>Monthly Report</Link><Link href="/reports?tab=social" aria-current={tab === "social" ? "page" : undefined}>Social Media Report</Link></nav>}
      {param("saved") === "1" && <p className="workspace-inline-success" role="status">Performance record saved.</p>}
      {param("queued") === "1" && <p className="workspace-inline-success" role="status">PDF generation is queued. The worker will update its status when processing completes.</p>}
      {surface === "reports" && <form className="workspace-panel workspace-toolbar insights-filters" action="/reports" role="search"><input type="hidden" name="tab" value={tab} /><label>Search<Input type="search" name="q" defaultValue={search} placeholder="Client or platform" /></label><label>Client<Select name="client_id" defaultValue={clientId}><option value="">All clients</option>{clients?.map(client => <option key={client.id} value={client.id}>{client.brand_name}</option>)}</Select></label><label>Period from<Input type="date" name="period_start" defaultValue={start} /></label><label>Period to<Input type="date" name="period_end" defaultValue={end} /></label><label>Status<Select name="report_status" defaultValue={reportStatus}><option value="">All statuses</option><option value="draft">Draft</option><option value="finalized">Finalized</option></Select></label><Button type="submit">Filter reports</Button></form>}

      {tab === "performance" ? <>
        <section className="workspace-panel" aria-labelledby="performance-heading">
          <h2 id="performance-heading">Content performance</h2>
          <p className="workspace-note">Engagement rate by reach = (likes + comments + shares + saves) ÷ reach × 100%. When reach is zero or missing, rate is N/A.</p>
          <form className="workspace-toolbar workspace-filter insights-filters" action="/performance" method="get" role="search">
            <input type="hidden" name="tab" value="performance" />
            <label>Search content<Input type="search" name="q" defaultValue={search} placeholder="Content title" /></label>
            <label>Client<Select name="client_id" defaultValue={clientId}><option value="">All clients</option>{(clients ?? []).map(c => <option key={c.id} value={c.id}>{c.brand_name}</option>)}</Select></label>
            <label>Platform<Select name="platform" defaultValue={platform}><option value="">All platforms</option>{[...new Set((schedules ?? []).map(s => s.platform))].map(p => <option key={p}>{p}</option>)}{["Instagram","TikTok","Facebook","YouTube","LinkedIn"].filter(p => !(schedules ?? []).some(s => s.platform === p)).map(p => <option key={p}>{p}</option>)}</Select></label>
            <label>Content type<Select name="content_type" defaultValue={contentType}><option value="">All types</option>{[...new Set((contentTypes ?? []).map(c => c.content_type))].map(type => <option key={type}>{type}</option>)}</Select></label>
            <label>From<Input type="date" name="period_start" defaultValue={start} /></label><label>To<Input type="date" name="period_end" defaultValue={end} /></label>
            <Button type="submit">Apply filters</Button>
          </form>
          <div className="metric-line">
            <span>Unique contents<strong>{number((summary as { content_count?: number } | null)?.content_count)}</strong></span>
            <span>Publications<strong>{number((summary as { publication_count?: number } | null)?.publication_count)}</strong></span>
            <span>Total reach<strong>{number((summary as { reach?: number | null } | null)?.reach)}</strong></span>
            <span>Total impressions<strong>{number((summary as { impressions?: number | null } | null)?.impressions)}</strong></span>
            <span>Total views<strong>{number((summary as { views?: number | null } | null)?.views)}</strong></span>
            <span>Total engagement<strong>{number((summary as { interactions?: number | null } | null)?.interactions)}</strong></span>
            <span>ER by reach<strong>{engagementRate == null ? "N/A" : `${engagementRate}%`}</strong><small>Weighted across matching latest publications</small></span>
          </div>
          {summaryError && <p className="workspace-inline-error" role="alert">Performance totals could not be calculated. Refresh or adjust the filters.</p>}
        </section>

        <div className="insights-trends">{buildTrendSeries(performanceRows ?? [], scheduleMap).map(series => <section className="workspace-panel trend-panel" key={series.label}><h3>{series.label}</h3>{series.points.length < 2 ? <p className="workspace-note">Not enough dated performance records to show a trend.</p> : <TrendChart points={series.points} label={series.label} />}</section>)}</div>

        <details className="workspace-panel"><summary className="workspace-summary">Add manual performance</summary><div className="workspace-form-wrap">
          <p className="workspace-note">Instagram and TikTok APIs are not connected. Record validated metrics manually; unavailable metrics may stay blank.</p>
          {scheduleError ? <p role="alert">Publication schedules could not be loaded.</p> : schedules?.length ? <form action={savePerformanceAction} className="workspace-form">
            <label className="field-wide">Published content<Select name="content_schedule_id" required defaultValue=""><option value="" disabled>Select a publication</option>{schedules.map(s => { const content = Array.isArray(s.contents) ? s.contents[0] : s.contents; return <option key={s.id} value={s.id}>{content?.title} · {s.platform} · {clientNames.get(s.client_id) ?? "Client"} · {s.published_at ? s.published_at.slice(0,10) : "Published"}</option>; })}</Select></label>
            <label>Measured at<Input type="datetime-local" name="measured_at" /></label><label>Measurement label<Input name="measurement_label" defaultValue="manual" maxLength={40} /></label>
            {(["reach","impressions","views","likes","comments","shares","saves"] as const).map(field => <label key={field}>{field[0].toUpperCase()+field.slice(1)}<Input type="number" min="0" step="1" name={field} /></label>)}
            <label className="field-wide">Content link<Input type="url" name="content_url" placeholder="https://..." /></label>
            <label className="field-wide">Evaluation notes<Textarea name="evaluation_notes" rows={2} maxLength={2000} /></label>
            <div className="form-actions"><Button variant="primary" type="submit">Save performance</Button></div>
          </form> : <p className="workspace-note">Mark a publication as published in Content Planner before recording its performance.</p>}
        </div></details>

        {performanceError || scheduleError ? <p role="alert">Performance history could not be loaded.</p> : performanceRows?.length ? <section className="workspace-panel"><div className="workspace-panel-header"><div><h2>Content performance records</h2><p>{performanceCount ?? 0} snapshots · latest records first</p></div></div><div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Content</th><th>Client</th><th>Platform · type</th><th>Published</th><th>Measured</th><th>Reach</th><th>Impressions</th><th>Views</th><th>Likes</th><th>Comments</th><th>Shares</th><th>Saves</th><th>ER by reach</th><th>History</th></tr></thead><tbody>
          {performanceRows.map(row => { const schedule = scheduleMap.get(row.content_schedule_id); const content = schedule && (Array.isArray(schedule.contents) ? schedule.contents[0] : schedule.contents); const rate = getEngagementRateByReach(row); return <tr key={row.id}>
            <td><Link className="workspace-primary-link" href={`/performance/${row.id}`}>{content?.title ?? "Content"}</Link></td><td>{clientNames.get(row.client_id) ?? "Client"}</td><td>{schedule?.platform} · {content?.content_type}</td><td>{schedule?.published_at ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(schedule.published_at)) : "—"}</td><td>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(row.measured_at))}<small className="task-secondary">{row.measurement_label}</small></td>
            <td>{number(row.reach)}</td><td>{number(row.impressions)}</td><td>{number(row.views)}</td><td>{number(row.likes)}</td><td>{number(row.comments)}</td><td>{number(row.shares)}</td><td>{number(row.saves)}</td><td>{rate == null ? "N/A" : `${rate}%`}</td><td><Link href={`/performance/${row.id}`}>View history</Link></td>
          </tr>; })}
        </tbody></table></div>{performanceCount && performanceCount > 20 && <nav className="workspace-pagination" aria-label="Performance record pages"><span>Page {performancePage} of {Math.ceil(performanceCount / 20)}</span>{performancePage > 1 && <Link className="button" href={performancePageHref(performancePage - 1, { clientId, platform, contentType, start, end, search })}>Previous</Link>}{performancePage * 20 < performanceCount && <Link className="button" href={performancePageHref(performancePage + 1, { clientId, platform, contentType, start, end, search })}>Next</Link>}</nav>}</section> : <EmptyState title="No performance records in this view">Use the filters above or record measurements for a published schedule. Each publication has its own metrics history.</EmptyState>}

      </> : tab === "social" ? <>
        <section className="workspace-panel"><div className="workspace-panel-header"><div><h2>Social Media Report</h2><p>Build a platform-specific report from saved publication snapshots.</p></div></div>{!clients?.length ? <p className="workspace-note">Add a client before creating a social media report.</p> : <form action={createSocialReportAction} className="workspace-form">
          <label>Client<Select name="client_id" required defaultValue={clientId}><option value="" disabled>Select a client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.brand_name}</option>)}</Select></label>
          <label>Platform<Select name="platform" required defaultValue={platform || "Instagram"}>{["Instagram","TikTok","Facebook","YouTube","LinkedIn","Other"].map(p => <option key={p}>{p}</option>)}</Select></label>
          <label>Account label<Input name="account_label" maxLength={120} placeholder="Account name or handle" /></label>
          <label>Period start<Input type="date" name="period_start" required defaultValue={start} /></label><label>Period end<Input type="date" name="period_end" required defaultValue={end} /></label>
          <fieldset className="field-wide performance-pick"><legend>Published performance snapshots to include</legend>{performanceRows?.length ? performanceRows.map(row => { const schedule=scheduleMap.get(row.content_schedule_id); const content=schedule && (Array.isArray(schedule.contents)?schedule.contents[0]:schedule.contents); return <label key={row.id}><input type="checkbox" name="performance_ids" value={row.id} />{content?.title} · {schedule?.platform} · reach {number(row.reach)}</label>; }) : <p className="workspace-note">No performance snapshots match the filters above.</p>}</fieldset>
          <label className="field-wide">Performance summary<Textarea name="summary" rows={2} /></label><label className="field-wide">Evaluation<Textarea name="evaluation" rows={2} /></label><label className="field-wide">Next strategy<Textarea name="next_plan" rows={2} /></label><div className="form-actions"><Button variant="primary" type="submit">Create report draft</Button></div>
        </form>}</section>
        {activeSocial && <section className="workspace-panel"><div className="workspace-panel-header"><div><h2>Report preview · {clientNames.get(activeSocial.client_id) ?? "Client"}</h2><p>{activeSocial.platform} · {activeSocial.account_label || "Account label not set"} · {activeSocial.period_start} to {activeSocial.period_end}</p></div></div><div className="metric-line"><span>Publication snapshots<strong>{socialPreviewRows.length}</strong></span><span>Unique contents<strong>{new Set(socialPreviewRows.map(row => row.schedule.content_id)).size}</strong></span><span>Reach<strong>{number(socialPreviewRows.reduce((sum,row)=>sum+(row.performance.reach??0),0))}</strong></span><span>Impressions<strong>{number(socialPreviewRows.reduce((sum,row)=>sum+(row.performance.impressions??0),0))}</strong></span><span>Views<strong>{number(socialPreviewRows.reduce((sum,row)=>sum+(row.performance.views??0),0))}</strong></span><span>Interactions<strong>{number(socialPreviewRows.reduce((sum,row)=>sum+getInteractions(row.performance),0))}</strong></span><span>ER by reach<strong>{(()=>{const reach=socialPreviewRows.reduce((sum,row)=>sum+(row.performance.reach??0),0);const interactions=socialPreviewRows.reduce((sum,row)=>sum+getInteractions(row.performance),0);return reach?`${(interactions/reach*100).toFixed(2)}%`:"N/A"})()}</strong></span></div>
          {updatedSocial && <form action={updatedSocial} className="workspace-form report-edit-form"><label>Account label<Input name="account_label" defaultValue={activeSocial.account_label} /></label><label>Period start<Input type="date" name="period_start" required defaultValue={activeSocial.period_start} /></label><label>Period end<Input type="date" name="period_end" required defaultValue={activeSocial.period_end} /></label><label className="field-wide">Summary<Textarea name="summary" rows={2} defaultValue={activeSocial.summary} /></label><label className="field-wide">Evaluation<Textarea name="evaluation" rows={2} defaultValue={activeSocial.evaluation} /></label><label className="field-wide">Next strategy<Textarea name="next_plan" rows={2} defaultValue={activeSocial.next_plan} /></label><div className="form-actions"><Button type="submit">Save draft</Button></div></form>}
          <form action={finalizeSocialReportAction}><input type="hidden" name="report_id" value={activeSocial.id} /><ConfirmSubmitButton className="ui-button ui-button-primary" prompt="Finalize this report? A fixed snapshot will be saved as a new version.">{`Finalize version ${activeSocial.latest_version + 1}`}</ConfirmSubmitButton></form>
        </section>}
        {reportsError ? <p role="alert">Social reports could not be loaded.</p> : visibleReports.length ? <ReportList reports={visibleReports as Array<Record<string, unknown>>} clientNames={clientNames} memberNames={memberNames} versions={newestSocial as Map<string, {id:string;version_number:number;finalized_at:string;finalized_by:string}>} versionHistory={(socialVersions ?? []) as Array<Record<string,unknown>>} jobs={pdfJobs ?? []} type="social" basePath={basePath} /> : <EmptyState title="No social reports in this view">Adjust the client or date filters, or create a social media report.</EmptyState>}
      </> : <>
        <section className="workspace-panel"><h2>Monthly Report</h2>{!clients?.length ? <p className="workspace-note">Add a client before creating a monthly report.</p> : <form action={createMonthlyReportAction} className="workspace-form">
          <label>Client<Select name="client_id" required defaultValue={clientId}><option value="" disabled>Select a client</option>{clients.map(c=><option key={c.id} value={c.id}>{c.brand_name}</option>)}</Select></label>
          <label>Period start<Input type="date" name="period_start" required defaultValue={start} /></label><label>Period end<Input type="date" name="period_end" required defaultValue={end} /></label>
          <label className="field-wide">Work summary<Textarea name="work_summary" rows={3} /></label><label className="field-wide">Evaluation<Textarea name="evaluation" rows={2} /></label><label className="field-wide">Challenges<Textarea name="challenges" rows={2} /></label><label className="field-wide">Next plan<Textarea name="next_plan" rows={2} /></label>
          <div className="form-actions"><Button variant="primary" type="submit">Create report draft</Button></div>
        </form>}</section>
        {activeMonthly && <section className="workspace-panel"><h2>Draft preview · {clientNames.get(activeMonthly.client_id) ?? "Client"}</h2><p className="workspace-note">{activeMonthly.period_start} to {activeMonthly.period_end}. Metrics below update from current source records until this version is finalized.</p>
          <div className="metric-line"><span>Contents produced<strong>{number(monthlyPreview?.contentCount)}</strong></span><span>Tasks in period<strong>{number(monthlyPreview?.tasks.length)}</strong></span><span>Done<strong>{number(monthlyPreview?.tasks.filter(t=>t.status==="done").length)}</strong></span><span>In progress<strong>{number(monthlyPreview?.tasks.filter(t=>t.status==="in_progress").length)}</strong></span><span>Review<strong>{number(monthlyPreview?.tasks.filter(t=>t.status==="review").length)}</strong></span></div>
          {monthlyPreview?.tasks.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Deadline</th></tr></thead><tbody>{monthlyPreview.tasks.map(task=><tr key={task.id}><td>{task.title}</td><td>{statuses[task.status as keyof typeof statuses] ?? task.status}</td><td>{task.priority}</td><td>{task.due_date ?? "—"}</td></tr>)}</tbody></table></div> : <p className="workspace-note">No due tasks in this period.</p>}
          {updatedMonthly && <form action={updatedMonthly} className="workspace-form report-edit-form"><label>Period start<Input type="date" name="period_start" required defaultValue={activeMonthly.period_start} /></label><label>Period end<Input type="date" name="period_end" required defaultValue={activeMonthly.period_end} /></label><label className="field-wide">Work summary<Textarea name="work_summary" rows={3} defaultValue={activeMonthly.work_summary} /></label><label className="field-wide">Evaluation<Textarea name="evaluation" rows={2} defaultValue={activeMonthly.evaluation} /></label><label className="field-wide">Challenges<Textarea name="challenges" rows={2} defaultValue={activeMonthly.challenges} /></label><label className="field-wide">Next plan<Textarea name="next_plan" rows={2} defaultValue={activeMonthly.next_plan} /></label><div className="form-actions"><Button type="submit">Save draft</Button></div></form>}
          <form action={finalizeMonthlyReportAction}><input type="hidden" name="report_id" value={activeMonthly.id} /><ConfirmSubmitButton className="ui-button ui-button-primary" prompt="Finalize this report? A fixed snapshot will be saved as a new version.">{`Finalize version ${activeMonthly.latest_version + 1}`}</ConfirmSubmitButton></form>
        </section>}
        {reportsError ? <p role="alert">Monthly reports could not be loaded.</p> : visibleReports.length ? <ReportList reports={visibleReports as Array<Record<string, unknown>>} clientNames={clientNames} memberNames={memberNames} versions={newestMonthly as Map<string, {id:string;version_number:number;finalized_at:string;finalized_by:string}>} versionHistory={(monthlyVersions ?? []) as Array<Record<string,unknown>>} jobs={pdfJobs ?? []} type="monthly" basePath={basePath} /> : <EmptyState title="No monthly reports in this view">Adjust the client or date filters, or create a monthly report.</EmptyState>}
      </>}
      <PdfJobs jobs={pdfJobs ?? []} />
    </div>
  </WorkspaceShell>;
}

function ReportList({ reports, clientNames, memberNames, versions, versionHistory, jobs, type, basePath }: { reports: Array<Record<string, unknown>>; clientNames: Map<string,string>; memberNames: Map<string,string>; versions: Map<string,{id:string;version_number:number;finalized_at:string;finalized_by:string}>; versionHistory: Array<Record<string,unknown>>; jobs: Array<Record<string,unknown>>; type: "monthly" | "social"; basePath: string }) {
  return <section className="workspace-panel"><div className="workspace-panel-header"><div><h2>{type === "monthly" ? "Monthly reports" : "Social media reports"}</h2><p>{reports.length} reports · draft and finalized versions</p></div></div><div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Report</th><th>Client</th><th>Period</th>{type === "social"&&<th>Platform</th>}<th>Version</th><th>Status</th><th>Created by</th><th>Finalized</th><th>Actions</th></tr></thead><tbody>
    {reports.map(report=>{const id=String(report.id);const version=versions.get(id);const versionKey=type==="monthly"?"monthly_report_version_id":"social_report_version_id";const pdf=jobs.find(job=>job.report_type===type&&job[versionKey as keyof typeof job]===version?.id);const relatedVersions=versionHistory.filter(row=>row[`${type}_report_id`]===id).sort((a,b)=>Number(b.version_number)-Number(a.version_number));return <tr key={id}><td>{type === "monthly" ? "Monthly activity" : `${String(report.platform)} social report`}</td><td>{clientNames.get(String(report.client_id))??"Client"}</td><td>{String(report.period_start)} – {String(report.period_end)}</td>{type==="social"&&<td>{String(report.platform)}</td>}<td>{version?`v${version.version_number}`:"—"}</td><td><span className={`workspace-status-badge workspace-status-${version?"approved":"todo"}`}>{version?"Finalized":"Draft"}</span></td><td>{memberNames.get(String(report.created_by))??"Agency member"}<small className="task-secondary">{new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeZone:"Asia/Jakarta"}).format(new Date(String(report.created_at)))}</small></td><td>{version?new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeZone:"Asia/Jakarta"}).format(new Date(version.finalized_at)):"—"}</td><td>
      <div className="workspace-actions">{version ? <><Link className="button button-quiet" href={`${basePath}?tab=${type}&${type}Report=${id}&version=${version.id}`}>Preview v{version.version_number}</Link>{pdf?.status==="completed"?<a className="button button-quiet" href={`/api/report-pdf/${pdf.id}`}>Download PDF</a>:pdf?.status==="queued"||pdf?.status==="processing"?<span className="workspace-note">PDF {String(pdf.status)}</span>:<form action={queueReportPdfAction}><input type="hidden" name="report_type" value={type}/><input type="hidden" name="version_id" value={version.id}/><Button type="submit">{pdf?.status==="failed"?"Retry PDF":"Generate PDF"}</Button></form>}</> : <Link className="button button-quiet" href={`${basePath}?tab=${type}&${type}Report=${id}`}>Open draft</Link>}<details className="report-version-list"><summary>Versions ({relatedVersions.length})</summary><ol>{relatedVersions.map(item=><li key={String(item.id)}><Link href={`${basePath}?tab=${type}&${type}Report=${id}&version=${item.id}`}>v{String(item.version_number)} · {new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeZone:"Asia/Jakarta"}).format(new Date(String(item.finalized_at)))}</Link></li>)}</ol></details></div>{Boolean(pdf?.last_error)&&<small className="task-secondary">{String(pdf?.last_error)}</small>}
    </td></tr>;})}
  </tbody></table></div></section>;
}

function PdfJobs({ jobs }: { jobs: Array<Record<string,unknown>> }) {
  const eligible = jobs.filter(job=>job.status==="completed"&&job.file_path);
  if (!eligible.length) return jobs.some(job=>job.status==="queued"||job.status==="processing"||job.status==="failed") ? <section className="workspace-panel"><h2>PDF generation</h2><ul>{jobs.filter(job=>job.status!=="completed").slice(0,10).map(job=><li key={String(job.id)}>{String(job.report_type)} report · {String(job.status)}{job.last_error?` · ${String(job.last_error)}`:""}</li>)}</ul><p className="workspace-note">A separate worker processes queued PDFs. Configure and run it to generate files.</p></section> : null;
  return <section className="workspace-panel"><h2>Generated report PDFs</h2><ul>{eligible.slice(0,20).map(job=><li key={String(job.id)}>{String(job.report_type)} report · <a href={`/api/report-pdf/${job.id}`} target="_blank" rel="noreferrer">Open PDF</a></li>)}</ul></section>;
}

function SnapshotPreview({ snapshot }: { snapshot: { version_number: number; snapshot_hash: string; snapshot_data: Record<string, unknown> } }) {
  const data=snapshot.snapshot_data;
  const metrics=data.metrics as Record<string,number|null>|undefined;
  const report=data.report as Record<string,unknown>|undefined;
  const period=data.period as Record<string,unknown>|undefined;
  const client=data.client as Record<string,unknown>|undefined;
  const narrative=data.narrative as Record<string,unknown>|undefined;
  const schedules=Array.isArray(data.schedules)?data.schedules as Array<Record<string,unknown>>:[];
  const items=Array.isArray(data.items)?data.items as Array<Record<string,unknown>>:[];
  const contents=Array.isArray(data.contents)?data.contents as Array<Record<string,unknown>>:[];
  const tasks=Array.isArray(data.tasks)?data.tasks as Array<Record<string,unknown>>:[];
  return <article className="workspace-panel snapshot-preview"><p className="workspace-note">BABE AGENCY · {String(data.reportType??report?.report_type??"Report").toUpperCase()} · VERSION {snapshot.version_number}</p><h2>{String(client?.brand_name??"Client")} report</h2>
    <p className="workspace-note">{String(data.platform??"")}{data.account_label?` · ${String(data.account_label)}`:""} · {String(period?.start??report?.period_start??"")} to {String(period?.end??report?.period_end??"")}</p>
    {narrative&&<div className="report-narrative">{Object.entries(narrative).filter(([,value])=>typeof value==="string"&&value.trim()).map(([key,value])=><section key={key}><h3>{key.replaceAll("_"," ").replace(/\b\w/g,l=>l.toUpperCase())}</h3><p>{String(value)}</p></section>)}</div>}
    {metrics&&<div className="metric-line">{["content_count","publication_count","reach","impressions","views","interactions","engagement_rate_by_reach"].map(key=><span key={key}>{key.replaceAll("_"," ")}<strong>{key==="engagement_rate_by_reach"?metrics[key]==null?"N/A":`${metrics[key]}%`:number(metrics[key])}</strong></span>)}</div>}
    {contents.length>0&&<div className="snapshot-list"><h3>Content in period</h3><ul>{contents.map(row=><li key={String(row.id)}>{String(row.title)} · {String(row.status)}</li>)}</ul></div>}
    {schedules.length>0&&<div className="snapshot-list"><h3>Publication schedules</h3><ul>{schedules.map(row=><li key={String(row.id)}>{String(row.platform)} · {String(row.status)} · {String(row.published_at??row.scheduled_at??"Unscheduled")}</li>)}</ul></div>}
    {tasks.length>0&&<div className="snapshot-list"><h3>Tasks in period</h3><ul>{tasks.map(row=><li key={String(row.id)}>{String(row.title)} · {String(row.status)} · {String(row.priority)}</li>)}</ul></div>}
    {items.length>0&&<div className="snapshot-list"><h3>Content performance</h3><div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Content</th><th>Platform</th><th>Published</th><th>Reach</th><th>Impressions</th><th>Views</th><th>Interactions</th><th>ER by reach</th></tr></thead><tbody>{items.map(row=><tr key={String(row.performance_id)}><td>{String(row.content_title)}</td><td>{String(row.platform)}</td><td>{String(row.published_at??"—")}</td><td>{number(row.reach as number|null)}</td><td>{number(row.impressions as number|null)}</td><td>{number(row.views as number|null)}</td><td>{number(row.interactions as number|null)}</td><td>{row.engagement_rate_by_reach==null?"N/A":`${String(row.engagement_rate_by_reach)}%`}</td></tr>)}</tbody></table></div></div>}
    <details><summary>Snapshot integrity hash</summary><code>{snapshot.snapshot_hash}</code><p className="workspace-note">Source changes do not alter this snapshot.</p></details>
  </article>;
}
