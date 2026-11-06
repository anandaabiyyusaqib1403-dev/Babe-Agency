import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskForm } from "@/components/task-form";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";
import { SetupNotice } from "@/components/setup-notice";
import { updateTaskAction } from "@/app/actions/operational-actions";

export const instant = false;

export default async function EditTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) return <SetupNotice />;
  const { taskId } = await params;
  const [{ data: task }, { data: clients }, { data: contents }, { data: members }] = await Promise.all([
    ctx.supabase.from("tasks").select("*").eq("id", taskId).is("archived_at", null).maybeSingle(),
    ctx.supabase.from("clients").select("id,brand_name").order("brand_name").limit(100),
    ctx.supabase.from("contents").select("id,title,client_id").order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("agency_members").select("id,full_name,email").eq("is_active", true).order("full_name").limit(100),
  ]);
  if (!task) notFound();
  const action = updateTaskAction.bind(null, task.id);
  return <WorkspaceShell title="Edit task" section="Management / To-do List / Edit" memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <div className="workspace-section">
      <section className="workspace-panel"><TaskForm action={action} values={task} clients={(clients ?? []).map(item => ({ id: item.id, label: item.brand_name }))} contents={(contents ?? []).map(item => ({ id: item.id, label: item.title, clientId: item.client_id }))} members={(members ?? []).map(item => ({ id: item.id, label: item.email ? `${item.full_name} (${item.email})` : item.full_name }))} submitLabel="Save changes" /></section>
      <Link className="button button-quiet" href="/tasks">Back to tasks</Link>
    </div>
  </WorkspaceShell>;
}
