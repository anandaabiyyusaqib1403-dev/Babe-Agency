export const instant = false;
import Link from "next/link";
import { Button, EmptyState, Input, Select, Table } from "@/components/ui";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SetupNotice } from "@/components/setup-notice";
import { Feedback } from "@/components/workspace/client-form";
import { ContentCreateForm } from "@/components/workspace/content-create-form";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";

type Params = Record<string, string | string[] | undefined>;
const one = (p: Params, k: string) => typeof p[k] === "string" ? String(p[k]).slice(0, 120) : "";
const statuses = ["planned", "idea", "brief", "in_production", "production", "internal_review", "review", "client_review", "revision", "approved", "completed", "published", "cancelled"];
const pageSize = 20;
const today = new Date();
const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(today);
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const validMonth = (v: string) => /^\d{4}-\d{2}$/.test(v) ? v : todayKey.slice(0, 7);

export default async function ContentPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) return <SetupNotice />;
  const params = await searchParams;
  const q = one(params, "q"), clientId = one(params, "client_id"), platform = one(params, "platform"), type = one(params, "content_type"), pillarId = one(params, "pillar_id"), status = one(params, "status");
  const view = one(params, "view") === "calendar" ? "calendar" : "table";
  const calendarMode = one(params, "mode") === "week" ? "week" : "month";
  const month = validMonth(one(params, "month"));
  const page = Math.max(1, Math.min(10000, Number(one(params, "page")) || 1));
  const safeQ = q.replace(/[%,()]/g, " ").trim();
  const startDate = calendarMode === "month" ? `${month}-01` : startOfWeek(one(params, "date") || `${month}-01`);
  const endDate = calendarMode === "month" ? dateKey(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1))) : plusDays(startDate, 7);
  const [{ data: clients }, { data: pillars }, { data: assignments }, { data: quotas }, { data: members }] = await Promise.all([
    ctx.supabase.from("clients").select("id,brand_name,status").is("deleted_at", null).order("brand_name").limit(200),
    ctx.supabase.from("content_pillars").select("id,client_id,pillar_name,status").eq("status", "active").order("pillar_name").limit(500),
    ctx.supabase.from("client_packages").select("id,client_id,package_name_snapshot,start_date,end_date").eq("status", "active").limit(200),
    ctx.supabase.from("client_package_quota_usage").select("client_package_id,content_type,quota,used").limit(500),
    ctx.supabase.from("agency_members").select("id,full_name").eq("is_active", true).order("full_name").limit(200),
  ]);
  const scheduleIdsForFilter: string[] = [];
  if (platform || one(params, "date_from") || one(params, "date_to")) {
    let scheduleFilter = ctx.supabase.from("content_schedules").select("content_id").order("scheduled_at", { ascending: false }).limit(5000);
    if (platform) scheduleFilter = scheduleFilter.eq("platform", platform);
    const from = one(params, "date_from"), to = one(params, "date_to");
    if (from) scheduleFilter = scheduleFilter.gte("scheduled_at", `${from}T00:00:00+07:00`);
    if (to) scheduleFilter = scheduleFilter.lt("scheduled_at", `${plusDays(to, 1)}T00:00:00+07:00`);
    const filtered = await scheduleFilter;
    scheduleIdsForFilter.push(...new Set((filtered.data ?? []).map(row => row.content_id)));
  }
  let calendarQuery = ctx.supabase.from("content_schedules").select("id,content_id,client_id,platform,scheduled_at,publication_status,contents!inner(title,workflow_status,content_type)").gte("scheduled_at", `${startDate}T00:00:00+07:00`).lt("scheduled_at", `${endDate}T00:00:00+07:00`).order("scheduled_at").limit(500);
  if (clientId) calendarQuery = calendarQuery.eq("client_id", clientId);
  if (platform) calendarQuery = calendarQuery.eq("platform", platform);
  if (type) calendarQuery = calendarQuery.eq("contents.content_type", type);
  if (status) calendarQuery = calendarQuery.eq("contents.workflow_status", status);
  if (pillarId) calendarQuery = calendarQuery.eq("contents.pillar_id", pillarId);
  if (safeQ) calendarQuery = calendarQuery.ilike("contents.title", `%${safeQ}%`);
  const { data: monthSchedules, error: calendarError } = view === "calendar" ? await calendarQuery : { data: [], error: null };
  let contentQuery = ctx.supabase.from("contents").select("id,title,client_id,content_type,platform,pillar_id,workflow_status,updated_at", { count: "exact" }).is("deleted_at", null).order("updated_at", { ascending: false });
  if (clientId) contentQuery = contentQuery.eq("client_id", clientId);
  if (type) contentQuery = contentQuery.eq("content_type", type);
  if (pillarId) contentQuery = contentQuery.eq("pillar_id", pillarId);
  if (statuses.includes(status)) contentQuery = contentQuery.eq("workflow_status", status);
  if (safeQ) contentQuery = contentQuery.ilike("title", `%${safeQ}%`);
  if (platform || one(params, "date_from") || one(params, "date_to")) contentQuery = scheduleIdsForFilter.length ? contentQuery.in("id", scheduleIdsForFilter) : contentQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  const { data: contentRows, count, error } = await contentQuery.range((page - 1) * pageSize, page * pageSize - 1);
  const contentIds = (contentRows ?? []).map(row => row.id);
  const schedulePage = view === "table" && contentIds.length ? await ctx.supabase.from("content_schedules").select("id,content_id,client_id,platform,scheduled_at,publication_status,published_at").in("content_id", contentIds).order("scheduled_at", { ascending: false, nullsFirst: false }).limit(500) : { data: [], error: null };
  const visibleScheduleRows = schedulePage.data ?? [];
  const scheduleByContent = new Map<string, typeof visibleScheduleRows>();
  for (const row of visibleScheduleRows) scheduleByContent.set(row.content_id, [...(scheduleByContent.get(row.content_id) ?? []), row]);
  const clientsById = new Map((clients ?? []).map(row => [row.id, row]));
  const pillarsById = new Map((pillars ?? []).map(row => [row.id, row]));
  const pages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const filterHref = (nextPage: number) => { const query = new URLSearchParams(); for (const [k, v] of [["q", q], ["client_id", clientId], ["platform", platform], ["content_type", type], ["pillar_id", pillarId], ["status", status], ["view", view], ["mode", calendarMode], ["month", month], ["date_from", one(params,"date_from")], ["date_to", one(params,"date_to")]] as const) if (v) query.set(k, v); query.set("page", String(nextPage)); return `/content?${query.toString()}`; };
  const monthLink = (offset: number) => { const d = new Date(`${month}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + offset); const p = new URLSearchParams(new URLSearchParams(filterHref(page).split("?")[1])); p.set("month", d.toISOString().slice(0, 7)); p.delete("page"); return `/content?${p.toString()}`; };
  const activeDate = one(params, "date") || `${month}-01`;
  const calendarPrev = calendarMode === "month" ? monthLink(-1) : calendarLink(plusDays(startDate, -7));
  const calendarNext = calendarMode === "month" ? monthLink(1) : calendarLink(plusDays(startDate, 7));
  function calendarLink(date: string) { const p = new URLSearchParams(filterHref(page).split("?")[1]); p.set("date", date); p.delete("page"); return `/content?${p.toString()}`; }
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${startDate}T00:00:00+07:00`));

  return <WorkspaceShell title="Content Planner" section="Workspace / Content Planner" memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <div className="workspace-page">
      <header className="workspace-page-intro"><div><p>Rencanakan produksi dan publikasi konten seluruh client.</p></div><a className="ui-button ui-button-primary" href="#add-content">Add Content</a></header>
      <Feedback saved={one(params,"saved")} error={one(params,"error")} />
      <section className="workspace-panel planner-filter-panel"><form className="workspace-toolbar planner-filter-form" action="/content" role="search">
        <label>Search content<Input type="search" name="q" defaultValue={q} placeholder="Cari judul konten" /></label>
        <label>Client<Select name="client_id" defaultValue={clientId}><option value="">Semua client</option>{clients?.map(row => <option key={row.id} value={row.id}>{row.brand_name}</option>)}</Select></label>
        <label>Platform<Input name="platform" list="planner-platforms" defaultValue={platform} placeholder="Semua platform" /><datalist id="planner-platforms">{["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn"].map(v => <option key={v} value={v} />)}</datalist></label>
        <label>Content type<Input name="content_type" list="planner-types" defaultValue={type} placeholder="Semua tipe" /><datalist id="planner-types">{[...new Set([...(quotas ?? []).map(q => q.content_type), "Reels", "Carousel", "Single Feed", "Story"])].map(v => <option key={v} value={v} />)}</datalist></label>
        <label>Pillar<Select name="pillar_id" defaultValue={pillarId}><option value="">Semua pillar</option>{pillars?.map(row => <option key={row.id} value={row.id}>{clientsById.get(row.client_id)?.brand_name} · {row.pillar_name}</option>)}</Select></label>
        <label>Status<Select name="status" defaultValue={status}><option value="">Semua status</option>{statuses.map(s => <option key={s} value={s}>{title(s)}</option>)}</Select></label>
        <label>From<Input type="date" name="date_from" defaultValue={one(params,"date_from")} /></label><label>To<Input type="date" name="date_to" defaultValue={one(params,"date_to")} /></label>
        <input type="hidden" name="view" value={view} /><input type="hidden" name="mode" value={calendarMode} /><input type="hidden" name="month" value={month} /><Button type="submit">Apply filters</Button><Link className="workspace-reset-link" href="/content">Reset</Link>
      </form><nav className="planner-view-toggle" aria-label="Content planner view"><Link aria-current={view === "table" ? "page" : undefined} href={filterHref(1).replace("view=calendar", "view=table")}>Table</Link><Link aria-current={view === "calendar" ? "page" : undefined} href={filterHref(1).replace("view=table", "view=calendar")}>Calendar</Link></nav></section>

      <details id="add-content" className="workspace-panel"><summary className="workspace-summary">Create master content</summary><div className="workspace-form-wrap">{clients?.length ? <ContentCreateForm clients={clients} pillars={pillars ?? []} assignments={assignments ?? []} quotas={quotas ?? []} members={members ?? []} /> : <p>Tambahkan client terlebih dahulu untuk mulai merencanakan konten.</p>}</div></details>

      {view === "table" ? <section className="workspace-panel"><div className="workspace-panel-header"><div><h2>Master content</h2><p>{number(count ?? 0)} konten · Page {page} dari {pages}</p></div></div>{error || schedulePage.error ? <p className="workspace-inline-error" role="alert">Content planner gagal dimuat. Coba refresh halaman.</p> : contentRows?.length ? <Table label="Master content"><thead><tr><th>Content title</th><th>Client</th><th>Pillar</th><th>Type</th><th>Platform</th><th>Publication schedule</th><th>Status</th><th>Action</th></tr></thead><tbody>{contentRows.map(row => { const schedules = scheduleByContent.get(row.id) ?? []; const schedule = schedules[0]; return <tr key={row.id}><td><Link className="workspace-primary-link" href={`/content/${row.id}`}>{row.title}</Link></td><td>{clientsById.get(row.client_id)?.brand_name ?? "Client"}</td><td>{row.pillar_id ? pillarsById.get(row.pillar_id)?.pillar_name ?? "—" : "—"}</td><td>{row.content_type}</td><td>{[...new Set(schedules.map(s => s.platform))].join(", ") || row.platform || "—"}</td><td>{schedule?.scheduled_at ? `${dateTime(schedule.scheduled_at)}${schedules.length > 1 ? ` · +${schedules.length - 1}` : ""}` : "Belum dijadwalkan"}</td><td><span className={`workspace-status-badge workspace-status-${row.workflow_status}`}>{title(row.workflow_status)}</span></td><td><Link href={`/content/${row.id}`}>Open</Link></td></tr>; })}</tbody></Table> : <EmptyState title="Konten belum ditemukan">Ubah filter atau buat master content baru. Jadwal publikasi tidak menambah jumlah master content.</EmptyState>}
        <nav className="workspace-pagination" aria-label="Pagination"><span>{number(count ?? 0)} master content · Page {page} dari {pages}</span><Link aria-disabled={page <= 1} href={filterHref(Math.max(1, page - 1))}>Sebelumnya</Link><Link aria-disabled={page >= pages} href={filterHref(Math.min(pages, page + 1))}>Berikutnya</Link></nav></section> : <section className="workspace-panel planner-calendar-panel"><header className="calendar-toolbar"><div className="calendar-month-nav"><Link aria-label="Previous period" href={calendarPrev}>‹</Link><h2>{calendarMode === "month" ? monthLabel : `${dateLabel(startDate)} - ${dateLabel(plusDays(endDate, -1))}`}</h2><Link aria-label="Next period" href={calendarNext}>›</Link></div><div className="calendar-view-controls"><Link href={calendarLink(todayKey)}>Today</Link><Link href={calendarLink(activeDate).replace("mode=week", "mode=month")} aria-current={calendarMode === "month" ? "page" : undefined}>Month</Link><Link href={calendarLink(activeDate).replace("mode=month", "mode=week")} aria-current={calendarMode === "week" ? "page" : undefined}>Week</Link><form action="/content" className="calendar-month-form">{[["view", "calendar"], ["mode", calendarMode], ["client_id", clientId], ["platform", platform], ["content_type", type], ["pillar_id", pillarId], ["status", status]].filter(([, v]) => v).map(([k,v]) => <input type="hidden" name={k} value={v} key={k} />)}<label className="visually-hidden" htmlFor="calendar-month">Choose month</label><input id="calendar-month" aria-label="Choose calendar month" type="month" name="month" defaultValue={month} /><Button type="submit">Go</Button></form></div></header>{calendarError ? <p role="alert">Kalender publikasi gagal dimuat.</p> : <Calendar schedules={monthSchedules ?? []} mode={calendarMode} startDate={startDate} clientNames={clientsById} />}</section>}

      {view === "calendar" && <p className="workspace-note">Kalender menampilkan jadwal publikasi dari master content yang sama. Klik jadwal untuk mengubah tanggal, platform, atau status.</p>}
    </div>
  </WorkspaceShell>;
}

function Calendar({ schedules, mode, startDate, clientNames }: { schedules: Array<{ id: string; content_id: string; client_id: string; platform: string; scheduled_at: string | null; publication_status: string; contents: unknown }>; mode: string; startDate: string; clientNames: Map<string, { brand_name: string; status: string }> }) {
  const actualStart = mode === "month" ? startOfWeek(startDate) : startDate;
  const total = mode === "month" ? 42 : 7;
  const days = Array.from({ length: total }, (_, i) => plusDays(actualStart, i));
  const grouped = new Map<string, typeof schedules>();
  for (const schedule of schedules) if (schedule.scheduled_at) { const key = dateKeyJakarta(schedule.scheduled_at); grouped.set(key, [...(grouped.get(key) ?? []), schedule]); }
  const weekDays = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  return <div className={`planner-calendar planner-calendar-${mode}`}><div className="calendar-weekdays">{weekDays.map(day => <span key={day}>{day}</span>)}</div><div className="calendar-days">{days.map(day => <div className={`calendar-day${day.slice(0,7) !== startDate.slice(0,7) ? " calendar-day-outside" : ""}`} key={day}><time dateTime={day}>{Number(day.slice(-2))}</time><ul>{(grouped.get(day) ?? []).map(schedule => { const content = schedule.contents as { title?: string; workflow_status?: string } | { title?: string; workflow_status?: string }[]; const item = Array.isArray(content) ? content[0] : content; return <li key={schedule.id}><Link href={`/content/${schedule.content_id}?tab=schedules`} title={`${item?.title ?? "Content"} · ${clientNames.get(schedule.client_id)?.brand_name ?? "Client"} · ${schedule.platform}`}><strong>{item?.title ?? "Content"}</strong><small>{clientNames.get(schedule.client_id)?.brand_name ?? "Client"} · {schedule.platform} · {item?.workflow_status?.replaceAll("_", " ") ?? schedule.publication_status}{schedule.scheduled_at ? ` · ${new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(schedule.scheduled_at))}` : ""}</small></Link></li>; })}</ul></div>)}</div></div>;
}

function dateKeyJakarta(value: string) { const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value)); return `${p.find(x => x.type === "year")?.value}-${p.find(x => x.type === "month")?.value}-${p.find(x => x.type === "day")?.value}`; }
function startOfWeek(value: string) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7)); return dateKey(date); }
function plusDays(value: string, days: number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return dateKey(date); }
function dateLabel(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(`${value}T00:00:00+07:00`)); }
function dateTime(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value)); }
function title(value: string) { return value.replaceAll("_", " ").replace(/(^|\s)\S/g, m => m.toUpperCase()); }
function number(value: number) { return new Intl.NumberFormat("id-ID").format(value); }
