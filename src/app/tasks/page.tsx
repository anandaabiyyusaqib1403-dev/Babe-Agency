export const instant = false;
import Link from "next/link";
import { Button, EmptyState, Input, Select } from "@/components/ui";
import { WorkspaceShell } from "@/components/workspace-shell";
import { TaskForm } from "@/components/task-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { archiveTaskAction, createTaskAction, updateReminderPreferencesAction, updateTaskStatusAction } from "@/app/actions/operational-actions";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";
import { SetupNotice } from "@/components/setup-notice";

const statuses: Record<string, string> = { todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done", cancelled: "Cancelled" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) return <SetupNotice />;
  const params = await searchParams;
  const one = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const filterStatus = one("status");
  const filterPriority = one("priority");
  const filterAssigned = one("assigned_to");
  const filterClient = one("client_id");
  const filterDeadline = one("deadline");
  const view = one("view") === "board" ? "board" : "table";
  const createTaskOpen = one("newTask") === "1";
  const query = one("q").slice(0, 100);
  const page = Math.max(1, Math.min(200, Number(one("page")) || 1));
  const todayParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const today = `${todayParts.find(part=>part.type==="year")?.value}-${todayParts.find(part=>part.type==="month")?.value}-${todayParts.find(part=>part.type==="day")?.value}`;
  const upcomingEnd = new Date(new Date(`${today}T00:00:00.000Z`).getTime() + 14 * 86400000).toISOString().slice(0, 10);
  let taskQuery = ctx.supabase.from("tasks").select("*", { count: "exact" }).is("archived_at", null).order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  if (filterStatus && filterStatus in statuses) taskQuery = taskQuery.eq("status", filterStatus);
  if (["low", "medium", "high", "urgent"].includes(filterPriority)) taskQuery = taskQuery.eq("priority", filterPriority);
  if (filterAssigned === "me") taskQuery = taskQuery.eq("assigned_to", ctx.user.id);
  else if (filterAssigned) taskQuery = taskQuery.eq("assigned_to", filterAssigned);
  if (filterClient) taskQuery = taskQuery.eq("client_id", filterClient);
  if (filterDeadline === "overdue") taskQuery = taskQuery.lt("due_date", today).neq("status", "done");
  if (filterDeadline === "upcoming") taskQuery = taskQuery.gte("due_date", today).lte("due_date", upcomingEnd).neq("status", "done");
  if (query) taskQuery = taskQuery.ilike("title", `%${query}%`);
  taskQuery = taskQuery.range((page - 1) * 50, page * 50 - 1);
  const [{ data: tasks, count, error }, { data: clients }, { data: members }, { data: contents }, { data: preferences }] = await Promise.all([
    taskQuery,
    ctx.supabase.from("clients").select("id,brand_name").order("brand_name").limit(100),
    ctx.supabase.from("agency_members").select("id,full_name,email").eq("is_active", true).order("full_name").limit(100),
    ctx.supabase.from("contents").select("id,title,client_id").order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("task_notification_preferences").select("email_enabled,reminder_offsets_days").eq("member_id",ctx.user.id).maybeSingle(),
  ]);
  const taskIds=(tasks??[]).map(task=>task.id);
  const { data: reminderEvents }=taskIds.length?await ctx.supabase.from("task_reminder_events").select("task_id,status").in("task_id",taskIds):{data:[]};
  const clientNames = new Map((clients ?? []).map(client => [client.id, client.brand_name]));
  const memberNames = new Map((members ?? []).map(member => [member.id, member.full_name]));
  const contentTitles = new Map((contents ?? []).map(content => [content.id, content.title]));
  const filters = new URLSearchParams();
  for (const key of ["status", "priority", "assigned_to", "client_id", "deadline", "q", "view"]) if (one(key)) filters.set(key, one(key));
  const nextHref = `/tasks?${new URLSearchParams([...filters, ["page", String(page + 1)]]).toString()}`;
  const priorHref = `/tasks?${new URLSearchParams([...filters, ["page", String(page - 1)]]).toString()}`;
  const membersList = (members ?? []).map(member => ({ id: member.id, label: member.email ? `${member.full_name} (${member.email})` : member.full_name }));

  const { data: summaryRows } = await ctx.supabase.from("tasks").select("status,due_date,assigned_to").is("archived_at", null).limit(5000);
  const summary = summaryRows ?? [];
  const summaryCount = (status?: string) => summary.filter(task => !status || task.status === status).length;
  const overdueCount = summary.filter(task => task.due_date && task.due_date < today && !["done", "cancelled"].includes(task.status)).length;

  return <WorkspaceShell title="To-do List" section="Management / To-do List" memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <div className="workspace-page management-page">
      <header className="workspace-page-intro management-intro"><div><p>Kelola pekerjaan agency, pantau deadline, dan lihat pembagian tugas.</p></div><a className="ui-button ui-button-primary" href="#create-task">Add Task</a></header>
      <section className="management-summary" aria-label="Task overview">{[["Total tasks", summaryCount()], ["To do", summaryCount("todo")], ["In progress", summaryCount("in_progress")], ["In review", summaryCount("review")], ["Completed", summaryCount("done")], ["Overdue", overdueCount]].map(([label, value]) => <div className="management-metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
    <div className="workspace-section">
      <details id="create-task" className="workspace-panel" open={createTaskOpen}>
        <summary className="workspace-summary">Add task</summary>
        <div className="workspace-form-wrap"><TaskForm action={createTaskAction} clients={(clients ?? []).map(client => ({ id: client.id, label: client.brand_name }))} contents={(contents ?? []).map(content => ({ id: content.id, label: content.title, clientId: content.client_id }))} members={membersList} submitLabel="Create task" /></div>
      </details>
      <details className="workspace-panel"><summary className="workspace-summary">Email reminder preferences</summary><div className="workspace-form-wrap"><form action={updateReminderPreferencesAction} className="workspace-section">
        <label className="checkbox-line"><input type="checkbox" name="email_enabled" defaultChecked={preferences?.email_enabled ?? true}/> Send reminders to my agency email{ctx.member.email ? ` (${ctx.member.email})` : " (email address not configured)"}</label>
        <p className="workspace-note">Schedule: H-3, H-1, and the deadline, at 09:00 WIB.</p>
        <Button type="submit">Save preferences</Button>
        <p className="workspace-note">Reminders enter the Google Sheets queue through the worker. Confirm actual delivery in Zapier Task History or Gmail Sent.</p>
      </form></div></details>
      <div className="workspace-panel"><div className="task-view-switch"><Link className={view === "table" ? "task-view-active" : ""} href="/tasks">Table</Link><Link className={view === "board" ? "task-view-active" : ""} href="/tasks?view=board">Board</Link></div><form className="workspace-toolbar workspace-filter" action="/tasks" method="get" role="search">
        <input type="hidden" name="view" value={view} />
        <label>Search<Input type="search" name="q" defaultValue={query} placeholder="Task title" /></label>
        <label>Status<Select name="status" defaultValue={filterStatus}><option value="">All statuses</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
        <label>Priority<Select name="priority" defaultValue={filterPriority}><option value="">All priorities</option>{["low", "medium", "high", "urgent"].map(item => <option key={item} value={item}>{item}</option>)}</Select></label>
        <label>PIC<Select name="assigned_to" defaultValue={filterAssigned}><option value="">All PICs</option><option value="me">My tasks</option>{membersList.map(member => <option key={member.id} value={member.id}>{member.label}</option>)}</Select></label>
        <label>Client<Select name="client_id" defaultValue={filterClient}><option value="">All clients</option>{(clients ?? []).map(client => <option key={client.id} value={client.id}>{client.brand_name}</option>)}</Select></label>
        <label>Deadline<Select name="deadline" defaultValue={filterDeadline}><option value="">Any deadline</option><option value="upcoming">Next 14 days</option><option value="overdue">Overdue</option></Select></label>
        <Button type="submit">Filter</Button><Link href="/tasks" className="button button-quiet">Clear</Link>
      </form></div>
      {error ? <p role="alert">Tasks could not be loaded. Refresh and try again.</p> : tasks?.length ? view === "board" ? <section className="task-board" aria-label="Tasks by status">{[["todo", "To Do"], ["in_progress", "In Progress"], ["review", "Review"], ["done", "Done"]].map(([status, label]) => <div className="task-board-column" key={status}><h2>{label}<span>{tasks.filter(task => task.status === status).length}</span></h2>{tasks.filter(task => task.status === status).map(task => <article className="task-board-card" key={task.id}><Link href={`/tasks/${task.id}`}><strong>{task.title}</strong></Link><small>{clientNames.get(task.client_id) ?? "Agency"} · {memberNames.get(task.assigned_to) ?? "Unassigned"}</small><div><span className={`task-priority task-priority-${task.priority}`}>{task.priority}</span><span className={task.due_date && task.due_date < today && task.status !== "done" ? "task-overdue" : ""}>{task.due_date ?? "No deadline"}</span></div><form action={updateTaskStatusAction.bind(null, task.id)}><Select name="status" defaultValue={task.status} aria-label={`Status for ${task.title}`}>{Object.entries(statuses).map(([value, name]) => <option value={value} key={value}>{name}</option>)}</Select><Button type="submit">Update</Button></form></article>)}</div>)}</section> : <div className="workspace-panel management-table-panel"><div className="workspace-panel-header"><div><h2>Tasks</h2><p>{count ?? 0} tasks · Page {page} of {Math.max(1, Math.ceil((count ?? 0) / 50))}</p></div></div><div className="workspace-table-wrap"><table className="workspace-table task-table">
        <thead><tr><th>Task</th><th>Client</th><th>Category</th><th>PIC</th><th>Priority</th><th>Deadline</th><th>Status</th><th>Reminder</th><th>Actions</th></tr></thead>
        <tbody>{tasks.map(task => {
          const isOverdue = task.due_date && task.due_date < today && task.status !== "done";
          return <tr key={task.id}>
            <td><Link className="workspace-primary-link" href={`/tasks/${task.id}`}><strong>{task.title}</strong></Link>{task.content_id && <small className="task-secondary">Content: {contentTitles.get(task.content_id) ?? "Linked content"}</small>}</td>
            <td>{clientNames.get(task.client_id) ?? "Agency"}</td><td>{task.category === "agency_task" ? "Agency" : "Client"}</td><td>{memberNames.get(task.assigned_to) ?? "Unassigned"}</td><td>{task.priority}</td>
            <td className={isOverdue ? "task-overdue" : ""}>{task.due_date ? <>{isOverdue && <span className="sr-only">Overdue: </span>}{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(`${task.due_date}T00:00:00+07:00`))}{isOverdue && <small className="task-secondary">Overdue</small>}</> : "No deadline"}</td>
            <td><form action={updateTaskStatusAction.bind(null, task.id)} className="workspace-status-form"><Select name="status" defaultValue={task.status} aria-label={`Status for ${task.title}`}>{Object.entries(statuses).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</Select><Button type="submit">Save</Button></form></td>
            <td>{(()=>{if(!task.reminder_enabled||!task.due_date)return "Off";if(!task.assigned_to)return "No PIC";const assigned=members?.find(m=>m.id===task.assigned_to);if(!assigned?.email)return "PIC email missing";const events=(reminderEvents??[]).filter(event=>event.task_id===task.id);const pending=events.filter(event=>event.status==="pending").length;const queued=events.filter(event=>event.status==="confirmation_required"||event.status==="queued").length;const sent=events.filter(event=>event.status==="sent").length;const failed=events.some(event=>event.status==="failed");return failed?"Queue failed":queued?`Sent confirmation required (${queued})`:sent?`Sent ${sent}/3`:pending?`Scheduled ${pending}/3`:"No future reminders";})()}</td>
            <td><div className="workspace-actions"><Link className="button button-quiet" href={`/tasks/${task.id}/edit`}>Edit</Link><form action={archiveTaskAction}><input type="hidden" name="task_id" value={task.id} /><ConfirmSubmitButton prompt="Archive this task? Its reminder and audit history will be retained." className="button button-quiet">Archive</ConfirmSubmitButton></form></div></td>
          </tr>;
        })}</tbody>
      </table></div></div> : <EmptyState title={query || filterStatus || filterPriority || filterClient || filterDeadline ? "No tasks match these filters" : "No tasks yet"}>{query || filterStatus || filterPriority || filterClient || filterDeadline ? "Clear or adjust a filter to see more tasks." : "Create an agency or client task to start tracking work."}</EmptyState>}
      {count && count > 50 && <nav className="workspace-pagination" aria-label="Task pages"><span>Page {page} of {Math.ceil(count / 50)}</span>{page > 1 && <Link className="button" href={priorHref}>Previous</Link>}{page * 50 < count && <Link className="button" href={nextHref}>Next</Link>}</nav>}
      <details className="workspace-panel workload-panel"><summary className="workspace-summary">Team workload</summary><div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Member</th><th>Active tasks</th><th>In progress</th><th>Completed</th><th>Overdue</th></tr></thead><tbody>{(members ?? []).map(member => { const own = summary.filter(task => task.assigned_to === member.id); return <tr key={member.id}><td>{member.full_name}</td><td>{own.filter(task => !["done", "cancelled"].includes(task.status)).length}</td><td>{own.filter(task => task.status === "in_progress").length}</td><td>{own.filter(task => task.status === "done").length}</td><td>{own.filter(task => task.due_date && task.due_date < today && !["done", "cancelled"].includes(task.status)).length}</td></tr>; })}</tbody></table></div></details>
    </div></div>
  </WorkspaceShell>;
}
