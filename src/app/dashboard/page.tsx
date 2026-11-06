import { connection } from "next/server";
import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";
import { SetupNotice } from "@/components/setup-notice";

const contentStages = [
  ["idea", "Content ideas"], ["in_production", "In production"],
  ["internal_review", "Internal review"], ["client_review", "Client review"],
  ["approved", "Approved"], ["published", "Published"],
] as const;
const taskStatus = { todo: "To do", in_progress: "In progress", review: "In review", done: "Done" };
const number = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("id-ID").format(value);
const dateOptions: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeZone: "Asia/Jakarta" };
const dateKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const formatDate = (value: string) => new Intl.DateTimeFormat("id-ID", dateOptions).format(new Date(`${value}T00:00:00+07:00`));

export default async function DashboardPage() {
  await connection();
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) return <SetupNotice />;

  const now = new Date();
  const today = dateKey(now);
  const ahead = new Date(`${today}T00:00:00+07:00`);
  ahead.setDate(ahead.getDate() + 14);
  const upcomingEnd = dateKey(ahead);
  const hour = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false }).format(now));
  const greeting = hour < 12 ? "Selamat pagi" : hour < 18 ? "Selamat siang" : "Selamat malam";
  const todayLabel = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "Asia/Jakarta" }).format(now);

  const [clientsCount, activeProjectsCount, pendingTasksCount, productionCount, approvalsCount,
    overdueResult, todayResult, upcomingResult, priorityResult, clientsResult, contentsResult,
    stageResults,
    taskActivityResult, approvalsActivityResult, newClientsResult, contentActivityResult, performanceResult] = await Promise.all([
    ctx.supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "active"),
    ctx.supabase.from("client_packages").select("id", { count: "exact", head: true }).eq("status", "active"),
    ctx.supabase.from("tasks").select("id", { count: "exact", head: true }).is("archived_at", null).in("status", ["todo", "in_progress", "review"]),
    ctx.supabase.from("contents").select("id", { count: "exact", head: true }).is("deleted_at", null).in("workflow_status", ["in_production", "production"]),
    ctx.supabase.from("content_approvals").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
    ctx.supabase.from("tasks").select("id,title,client_id,assigned_to,due_date,status,priority").is("archived_at", null).neq("status", "done").lt("due_date", today).order("due_date").limit(5),
    ctx.supabase.from("tasks").select("id,title,client_id,assigned_to,due_date,status,priority").is("archived_at", null).neq("status", "done").eq("due_date", today).order("priority", { ascending: false }).limit(5),
    ctx.supabase.from("tasks").select("id,title,client_id,assigned_to,due_date,status,priority").is("archived_at", null).neq("status", "done").gt("due_date", today).lte("due_date", upcomingEnd).order("due_date").limit(5),
    ctx.supabase.from("tasks").select("id,title,client_id,assigned_to,due_date,status,priority").is("archived_at", null).neq("status", "done").in("priority", ["high", "urgent"]).order("due_date", { ascending: true, nullsFirst: false }).limit(5),
    ctx.supabase.from("clients").select("id,brand_name,status,created_at").eq("status", "active").order("created_at", { ascending: false }).limit(5),
    ctx.supabase.from("contents").select("id,title,client_id,workflow_status,updated_at").is("deleted_at", null).order("updated_at", { ascending: false }).limit(20),
    Promise.all(contentStages.map(([status]) => ctx.supabase.from("contents").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("workflow_status", status))),
    ctx.supabase.from("task_activity_logs").select("id,task_id,action,created_at,new_value").order("created_at", { ascending: false }).limit(8),
    ctx.supabase.from("content_approval_history").select("id,approval_id,new_status,created_at").order("created_at", { ascending: false }).limit(5),
    ctx.supabase.from("clients").select("id,brand_name,created_at").order("created_at", { ascending: false }).limit(5),
    ctx.supabase.from("contents").select("id,title,client_id,workflow_status,updated_at").is("deleted_at", null).order("updated_at", { ascending: false }).limit(5),
    ctx.supabase.rpc("get_performance_summary", { p_client_id: null, p_platform: null, p_period_start: null, p_period_end: null, p_content_type: null }),
  ]);

  const contentRows = contentsResult.data ?? [];
  const stageCounts = new Map(contentStages.map(([status], index) => [status, stageResults[index].count ?? 0]));
  const taskIds = [...new Set([...(overdueResult.data ?? []), ...(todayResult.data ?? []), ...(upcomingResult.data ?? []), ...(priorityResult.data ?? [])].map(task => task.id))];
  const clientIds = [...new Set([...(overdueResult.data ?? []), ...(todayResult.data ?? []), ...(upcomingResult.data ?? []), ...(priorityResult.data ?? []), ...(clientsResult.data ?? []), ...contentRows].flatMap(row => "client_id" in row && row.client_id ? [row.client_id] : []))];
  const contentIds = [...new Set([...(taskActivityResult.data ?? []).map(row => row.task_id), ...(approvalsActivityResult.data ?? []).map(row => row.approval_id)])];
  const [{ data: members, error: membersError }, { data: clientPackages, error: packagesError }, { data: activityTasks, error: activityTasksError }, { data: approvals, error: approvalsError }, { data: clients, error: clientsError }] = await Promise.all([
    ctx.supabase.from("agency_members").select("id,full_name").eq("is_active", true).limit(200),
    clientIds.length ? ctx.supabase.from("client_packages").select("id,client_id,package_name_snapshot,start_date,end_date,status").in("client_id", clientIds).eq("status", "active").order("start_date", { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    taskIds.length ? ctx.supabase.from("tasks").select("id,title").in("id", taskIds).limit(50) : Promise.resolve({ data: [], error: null }),
    contentIds.length ? ctx.supabase.from("content_approvals").select("id,content_id").in("id", contentIds).limit(50) : Promise.resolve({ data: [], error: null }),
    clientIds.length ? ctx.supabase.from("clients").select("id,brand_name").in("id", clientIds).limit(100) : Promise.resolve({ data: [], error: null }),
  ]);
  const clientsById = new Map((clients ?? []).map(row => [row.id, row.brand_name]));
  const packagesByClient = new Map<string, NonNullable<typeof clientPackages>[number]>();
  for (const item of clientPackages ?? []) if (!packagesByClient.has(item.client_id)) packagesByClient.set(item.client_id, item);
  const membersById = new Map((members ?? []).map(row => [row.id, row.full_name]));
  const tasksById = new Map((activityTasks ?? []).map(row => [row.id, row.title]));
  const approvalContent = new Map((approvals ?? []).map(row => [row.id, row.content_id]));
  const contentById = new Map(contentRows.map(row => [row.id, row]));
  const taskError = [overdueResult.error, todayResult.error, upcomingResult.error, priorityResult.error, taskActivityResult.error, activityTasksError].some(Boolean);
  const clientError = [clientsResult.error, packagesError, clientsError, newClientsResult.error].some(Boolean);
  const contentError = Boolean(contentsResult.error || contentActivityResult.error || approvalsError || membersError);
  const dateTime = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
  const activities = [
    ...(newClientsResult.data ?? []).map(row => ({ id: `client-${row.id}`, at: row.created_at, label: `Client baru · ${row.brand_name}`, href: "/clients" })),
    ...(contentActivityResult.data ?? []).map(row => ({ id: `content-${row.id}`, at: row.updated_at, label: `Konten diperbarui · ${row.title}`, href: "/content" })),
    ...(taskActivityResult.data ?? []).map(row => ({ id: `task-${row.id}`, at: row.created_at, label: `${row.action === "task_created" ? "Task dibuat" : row.action === "status_changed" ? "Status task berubah" : "Task diperbarui"} · ${tasksById.get(row.task_id) ?? "Task"}`, href: tasksById.has(row.task_id) ? `/tasks?${new URLSearchParams({ q: tasksById.get(row.task_id)! })}` : "/tasks" })),
    ...(approvalsActivityResult.data ?? []).map(row => { const contentId = approvalContent.get(row.approval_id); return { id: `approval-${row.id}`, at: row.created_at, label: `Approval diperbarui · ${contentById.get(contentId ?? "")?.title ?? "Konten"}`, href: "/content" }; }),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const performanceRow = performanceResult.data as Record<string, unknown> | null;

  return <WorkspaceShell title="Studio Overview" section="Studio / Studio Overview" memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <div className="dashboard-page dashboard-v2">
      <header className="dashboard-intro dashboard-v2-intro">
        <div><p className="page-kicker">{greeting}, {ctx.member.full_name.split(/\s+/)[0]}</p><p className="page-description">Ringkasan aktivitas dan pekerjaan workspace BABE AGENCY.</p></div>
        <time dateTime={today}>{todayLabel}</time>
      </header>
      {(clientsCount.error || activeProjectsCount.error || pendingTasksCount.error || productionCount.error || approvalsCount.error || stageResults.some(result => result.error) || contentError || taskError || clientError || performanceResult.error || taskActivityResult.error || approvalsActivityResult.error) && <p className="dashboard-data-note" role="status">Sebagian data workspace tidak tersedia. Periksa koneksi database dan migrasi yang berlaku.</p>}

      <section className="dashboard-kpis dashboard-v2-kpis" aria-label="Ringkasan workspace">
        <Kpi label="Active clients" value={clientsCount.error ? null : clientsCount.count} href="/clients" />
        <Kpi label="Active projects" value={activeProjectsCount.error ? null : activeProjectsCount.count} href="/clients" />
        <Kpi label="Pending tasks" value={pendingTasksCount.error ? null : pendingTasksCount.count} href="/tasks" />
        <Kpi label="Content in production" value={productionCount.error ? null : productionCount.count} href="/content" />
        <Kpi label="Pending approval" value={approvalsCount.error ? null : approvalsCount.count} href="/content" />
      </section>

      <div className="dashboard-primary-grid dashboard-v2-grid">
        <section className="dashboard-panel" aria-labelledby="attention-title"><Heading id="attention-title" title="Task overview" detail="Pekerjaan yang perlu diperhatikan" href="/tasks" link="Semua task" />
          {taskError ? <Empty>Daftar task belum bisa dimuat.</Empty> : <div className="dashboard-task-groups">{[["Overdue", overdueResult.data], ["Due today", todayResult.data], ["Upcoming deadlines", upcomingResult.data], ["High priority", priorityResult.data]].map(([title, rows]) => <div className="dashboard-task-group" key={title as string}><h3>{title as string}</h3>{(rows as NonNullable<typeof overdueResult.data>)?.length ? <ul className="dashboard-deadline-list">{(rows as NonNullable<typeof overdueResult.data>).map(task => <li key={task.id}><div><Link href={`/tasks/${task.id}/edit`}>{task.title}</Link><small>{task.client_id ? clientsById.get(task.client_id) ?? "Client" : "Agency"} · {task.assigned_to ? membersById.get(task.assigned_to) ?? "PIC" : "Belum ada PIC"} · {taskStatus[task.status as keyof typeof taskStatus] ?? task.status} · {task.priority}</small></div><time>{task.due_date ? formatDate(task.due_date) : "Tanpa deadline"}</time></li>)}</ul> : <p className="dashboard-inline-empty">Tidak ada task.</p>}</div>)}</div>}
        </section>
        <section className="dashboard-panel" aria-labelledby="content-title"><Heading id="content-title" title="Content overview" detail="Jumlah master content menurut tahap" href="/content" link="Content planner" />
          {contentsResult.error || stageResults.some(result => result.error) ? <Empty>Ringkasan content belum bisa dimuat.</Empty> : <ul className="dashboard-stage-list">{contentStages.map(([key, label]) => <li key={key}><span>{label}</span><strong>{number(stageCounts.get(key) ?? 0)}</strong></li>)}</ul>}
        </section>
      </div>

      <div className="dashboard-primary-grid dashboard-v2-grid dashboard-v2-lower">
        <section className="dashboard-panel" aria-labelledby="activity-title"><Heading id="activity-title" title="Workspace activity" detail="Aktivitas terbaru" href="/tasks" link="Buka workspace" />
          {activities.length ? <ul className="dashboard-activity-list">{activities.map(item => <li key={item.id}><Link href={item.href}>{item.label}</Link><time dateTime={item.at}>{dateTime(item.at)}</time></li>)}</ul> : <Empty>{taskActivityResult.error || approvalsActivityResult.error || contentError || clientError ? "Aktivitas belum bisa dimuat." : "Aktivitas workspace akan muncul di sini saat ada perubahan."}</Empty>}
        </section>
        <section className="dashboard-panel" aria-labelledby="clients-title"><Heading id="clients-title" title="Active clients" detail="Client terbaru yang aktif" href="/clients" link="Semua client" />
          {clientError ? <Empty>Data client belum bisa dimuat.</Empty> : clientsResult.data?.length ? <ul className="dashboard-client-list">{clientsResult.data.map(client => { const service = packagesByClient.get(client.id); return <li key={client.id}><Link href="/clients"><strong>{client.brand_name}</strong><span>{client.status} · {service?.package_name_snapshot ?? "Paket belum diatur"}</span><small>{service ? `${formatDate(service.start_date)} – ${service.end_date ? formatDate(service.end_date) : "Berjalan"}` : "Periode layanan belum tersedia"}</small></Link></li>; })}</ul> : <Empty>Belum ada client aktif.</Empty>}
        </section>
      </div>

      <section className="dashboard-panel" aria-labelledby="performance-title"><Heading id="performance-title" title="Performance summary" detail="Snapshot performa tersimpan" href="/performance" link="Buka performance" />
        {performanceResult.error ? <Empty>Snapshot performa belum bisa dimuat.</Empty> : performanceRow && Number(performanceRow.snapshot_count) > 0 ? <><div className="dashboard-performance-metrics">{([["Total reach", performanceRow.reach], ["Total impressions", performanceRow.impressions], ["Total engagement", performanceRow.interactions]] as const).map(([label, value]) => <div key={label}><span>{label}</span><strong>{number(typeof value === "number" ? value : value == null ? null : Number(value))}</strong></div>)}</div><p className="dashboard-best-content">Best performing content belum tersedia dari ringkasan performa yang terhubung.</p></> : <Empty>Belum ada performance snapshot tersimpan.</Empty>}
      </section>
    </div>
  </WorkspaceShell>;
}

function Kpi({ label, value, href }: { label: string; value: number | null; href: string }) { return <Link className="dashboard-kpi" href={href}><span>{label}</span><strong>{number(value)}</strong><small>Lihat ringkasan</small></Link>; }
function Heading({ id, title, detail, href, link }: { id: string; title: string; detail: string; href: string; link: string }) { return <div className="dashboard-panel-heading"><div><h2 id={id}>{title}</h2><p>{detail}</p></div><Link href={href}>{link}</Link></div>; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="dashboard-inline-empty">{children}</p>; }
