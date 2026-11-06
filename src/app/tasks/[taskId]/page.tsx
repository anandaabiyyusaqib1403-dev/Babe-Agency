import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveTaskAction, updateTaskStatusAction } from "@/app/actions/operational-actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Button, Select } from "@/components/ui";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SetupNotice } from "@/components/setup-notice";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";

export const instant = false;
const date = (value: string | null) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(`${value.slice(0, 10)}T00:00:00+07:00`)) : "—";
const time = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
const statusLabel: Record<string, string> = { todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done" };

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) return <SetupNotice />;
  const { taskId } = await params;
  const { data: task, error } = await ctx.supabase.from("tasks").select("*").eq("id", taskId).is("archived_at", null).maybeSingle();
  if (error || !task) notFound();
  const [{ data: client }, { data: content }, { data: members }, { data: logs }, { data: reminders }] = await Promise.all([
    task.client_id ? ctx.supabase.from("clients").select("brand_name").eq("id", task.client_id).maybeSingle() : Promise.resolve({ data: null }),
    task.content_id ? ctx.supabase.from("contents").select("title").eq("id", task.content_id).maybeSingle() : Promise.resolve({ data: null }),
    ctx.supabase.from("agency_members").select("id,full_name").eq("is_active", true).limit(300),
    ctx.supabase.from("task_activity_logs").select("id,actor_id,action,old_value,new_value,created_at").eq("task_id", task.id).order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("task_reminder_events").select("id,reminder_offset_days,scheduled_at,status,updated_at,last_error").eq("task_id", task.id).order("scheduled_at", { ascending: true }).limit(20),
  ]);
  const reminderIds = (reminders ?? []).map(row => row.id);
  const { data: queueRows } = reminderIds.length ? await ctx.supabase.from("email_reminder_queue").select("reminder_id,sync_status,updated_at").in("reminder_id", reminderIds) : { data: [] };
  const queueByReminder = new Map((queueRows ?? []).map(row => [row.reminder_id, row]));
  const memberNames = new Map((members ?? []).map(row => [row.id, row.full_name]));
  return <WorkspaceShell title="Task detail" section="Management / To-do List / Task detail" memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <div className="workspace-page management-page">
      <header className="workspace-page-intro review-intro"><div><p><Link href="/tasks">To-do List</Link> / Task detail</p><h2>{task.title}</h2><span className={`workspace-status-badge workspace-status-${task.status}`}>{statusLabel[task.status] ?? task.status}</span></div><div className="workspace-actions"><Link className="ui-button ui-button-secondary" href={`/tasks/${task.id}/edit`}>Edit task</Link><form action={archiveTaskAction}><input type="hidden" name="task_id" value={task.id}/><ConfirmSubmitButton prompt="Archive this task? Its reminder and audit history will be retained." className="ui-button ui-button-quiet">Archive</ConfirmSubmitButton></form></div></header>
      <div className="review-layout"><div className="review-main">
        <section className="workspace-panel"><div className="workspace-panel-header"><div><h2>Task information</h2></div><form className="workspace-status-form" action={updateTaskStatusAction.bind(null, task.id)}><Select name="status" defaultValue={task.status} aria-label="Change task status">{Object.entries(statusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select><Button type="submit">Update status</Button></form></div><p className="review-copy">{task.description || "No description added."}</p><dl className="client-info-grid"><div><dt>Task type</dt><dd>{task.category === "agency_task" ? "Agency Task" : "Client Task"}</dd></div><div><dt>Priority</dt><dd>{task.priority}</dd></div><div><dt>Client</dt><dd>{client?.brand_name ?? "Agency"}</dd></div><div><dt>Related content</dt><dd>{content?.title ?? "—"}</dd></div><div><dt>Assigned to</dt><dd>{memberNames.get(task.assigned_to) ?? "Agency member"}</dd></div><div><dt>Start date</dt><dd>{date(task.start_date)}</dd></div><div><dt>Due date</dt><dd>{date(task.due_date)}</dd></div><div><dt>Created by</dt><dd>{memberNames.get(task.created_by) ?? "Agency member"}</dd></div><div><dt>Created at</dt><dd>{time(task.created_at)}</dd></div><div><dt>Last updated</dt><dd>{time(task.updated_at)}</dd></div></dl>{task.dependency_notes && <p className="workspace-note">Notes: {task.dependency_notes}</p>}</section>
        <section className="workspace-panel"><h2>Activity history</h2>{logs?.length ? <ol className="management-timeline">{logs.map(log => <li key={log.id}><div><strong>{log.action.replaceAll("_", " ")}</strong><time>{time(log.created_at)}</time></div><p>{log.old_value ? `${JSON.stringify(log.old_value)} → ` : ""}{log.new_value ? JSON.stringify(log.new_value) : ""}</p><small>{memberNames.get(log.actor_id ?? "") ?? "Agency member"}</small></li>)}</ol> : <p className="workspace-note">No recorded activity yet.</p>}</section>
      </div><aside className="review-side"><section className="workspace-panel"><h2>Deadline reminders</h2><p className="workspace-note">Queued in Google Sheets does not mean the email has been sent. Verify confirmation-required items in Zapier or Gmail.</p>{reminders?.length ? <ul className="workspace-compact-list">{reminders.map(reminder => { const queue = queueByReminder.get(reminder.id); const queueStatus = queue?.sync_status === "confirmation_required" ? "Confirmation Required" : queue?.sync_status === "synced" || queue?.sync_status === "syncing" ? "Queued" : queue?.sync_status === "failed" ? "Failed" : queue?.sync_status === "cancelled" ? "Cancelled" : reminder.status.replaceAll("_", " "); return <li key={reminder.id}><span>H-{reminder.reminder_offset_days || "0 (deadline)"} · {queueStatus}</span><span>{time(reminder.scheduled_at)}{queue?.updated_at && <small className="task-secondary">Updated {time(queue.updated_at)}</small>}</span></li>; })}</ul> : <p className="workspace-note">{task.reminder_enabled ? "No reminder events are currently recorded." : "Reminders are turned off for this task."}</p>}</section></aside></div>
    </div>
  </WorkspaceShell>;
}
