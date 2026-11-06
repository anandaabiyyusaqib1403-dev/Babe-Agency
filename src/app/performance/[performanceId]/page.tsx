import Link from "next/link";
import { notFound } from "next/navigation";
import { savePerformanceAction } from "@/app/actions/operational-actions";
import { Button, Input, Textarea } from "@/components/ui";
import { SetupNotice } from "@/components/setup-notice";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";
import { getEngagementRateByReach, getInteractions } from "@/lib/performance";

export const instant = false;
const number = (value: number | null) => value == null ? "N/A" : new Intl.NumberFormat("id-ID").format(value);
const dateTime = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));

export default async function PerformanceDetailPage({ params, searchParams }: { params: Promise<{ performanceId: string }>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) return <SetupNotice />;
  const [{ performanceId }, query] = await Promise.all([params, searchParams]);
  const { data: record, error } = await ctx.supabase.from("performances").select("*").eq("id", performanceId).maybeSingle();
  if (error || !record) notFound();
  const [{ data: schedule }, { data: history }, { data: client }] = await Promise.all([
    ctx.supabase.from("content_schedules").select("id,content_id,client_id,platform,scheduled_at,published_at,publication_status,post_url,contents!inner(id,title,content_type)").eq("id", record.content_schedule_id).maybeSingle(),
    ctx.supabase.from("performances").select("id,measured_at,measurement_label,reach,impressions,views,likes,comments,shares,saves,created_by").eq("content_schedule_id", record.content_schedule_id).order("measured_at", { ascending: false }).limit(100),
    ctx.supabase.from("clients").select("brand_name").eq("id", record.client_id).maybeSingle(),
  ]);
  if (!schedule) notFound();
  const content = Array.isArray(schedule.contents) ? schedule.contents[0] : schedule.contents;
  const rate = getEngagementRateByReach(record);
  return <WorkspaceShell title="Performance detail" section="Insights / Performance / Detail" memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <div className="workspace-page insights-page">
      <header className="workspace-page-intro management-intro"><div><p><Link href="/performance">Performance</Link> / {client?.brand_name ?? "Client"}</p><h2>{content?.title ?? "Content performance"}</h2><p>{schedule.platform} · {content?.content_type} · Published {schedule.published_at ? dateTime(schedule.published_at) : "—"}</p></div><Link className="ui-button ui-button-secondary" href="/performance?tab=performance">Back to performance</Link></header>
      {query.saved === "1" && <p className="workspace-inline-success" role="status">Performance record updated.</p>}
      <section className="workspace-panel"><div className="workspace-panel-header"><div><h2>Publication details</h2><p>Each schedule is tracked separately, even when several belong to the same content.</p></div></div><dl className="client-info-grid"><div><dt>Client</dt><dd>{client?.brand_name ?? "—"}</dd></div><div><dt>Content ID</dt><dd>{content?.id ?? schedule.content_id}</dd></div><div><dt>Publication schedule ID</dt><dd>{schedule.id}</dd></div><div><dt>Platform</dt><dd>{schedule.platform}</dd></div><div><dt>Scheduled</dt><dd>{schedule.scheduled_at ? dateTime(schedule.scheduled_at) : "—"}</dd></div><div><dt>Published URL</dt><dd>{record.content_url || schedule.post_url ? <a href={record.content_url || schedule.post_url!} target="_blank" rel="noreferrer">Open publication</a> : "—"}</dd></div><div><dt>Measured at</dt><dd>{dateTime(record.measured_at)} · {record.measurement_label}</dd></div></dl></section>
      <section className="workspace-panel"><div className="workspace-panel-header"><div><h2>Performance metrics</h2><p>Engagement rate by reach = interactions ÷ reach × 100%. Interactions are likes + comments + shares + saves.</p></div></div><div className="insight-metrics">{[["Reach", record.reach], ["Impressions", record.impressions], ["Views", record.views], ["Likes", record.likes], ["Comments", record.comments], ["Shares", record.shares], ["Saves", record.saves], ["Interactions", getInteractions(record)], ["ER by reach", rate == null ? "N/A" : `${rate}%`]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{typeof value === "number" ? number(value) : value}</strong></div>)}</div>{record.evaluation_notes && <div className="report-narrative"><h3>Evaluation notes</h3><p>{record.evaluation_notes}</p></div>}</section>
      <section className="workspace-panel"><div className="workspace-panel-header"><div><h2>Update this measurement</h2><p>Saving an update edits this snapshot. Add a new record from Performance to keep a separate measurement history entry.</p></div></div><form action={savePerformanceAction} className="workspace-form"><input type="hidden" name="performance_id" value={record.id}/>{(["reach","impressions","views","likes","comments","shares","saves"] as const).map(field=><label key={field}>{field[0].toUpperCase()+field.slice(1)}<Input type="number" min="0" step="1" name={field} defaultValue={record[field] ?? ""}/></label>)}<label className="field-wide">Published URL<Input type="url" name="content_url" defaultValue={record.content_url ?? ""}/></label><label className="field-wide">Evaluation notes<Textarea name="evaluation_notes" rows={4} maxLength={2000} defaultValue={record.evaluation_notes ?? ""}/></label><div className="form-actions"><Button variant="primary" type="submit">Save changes</Button></div></form></section>
      <section className="workspace-panel"><div className="workspace-panel-header"><div><h2>Performance history</h2><p>Records for this publication schedule only.</p></div></div>{history?.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Recorded at</th><th>Label</th><th>Reach</th><th>Impressions</th><th>Views</th><th>Interactions</th><th>ER by reach</th><th>Record</th></tr></thead><tbody>{history.map(item=>{const itemRate=getEngagementRateByReach(item);return <tr key={item.id}><td>{dateTime(item.measured_at)}</td><td>{item.measurement_label}</td><td>{number(item.reach)}</td><td>{number(item.impressions)}</td><td>{number(item.views)}</td><td>{number(getInteractions(item))}</td><td>{itemRate==null?"N/A":`${itemRate}%`}</td><td>{item.id===record.id?"Current record":<Link href={`/performance/${item.id}`}>Open</Link>}</td></tr>;})}</tbody></table></div> : <p className="workspace-note">No prior measurement snapshots.</p>}</section>
    </div>
  </WorkspaceShell>;
}
