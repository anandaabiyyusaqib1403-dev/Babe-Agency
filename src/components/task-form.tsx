import { Button, Input, Select, Textarea } from "@/components/ui";

type Option = { id: string; label: string; clientId?: string };
type TaskValues = {
  title?: string; description?: string | null; category?: string; responsibility?: string;
  client_id?: string | null; content_id?: string | null; assigned_to?: string | null;
  priority?: string; status?: string; start_date?: string | null; due_date?: string | null;
  reminder_enabled?: boolean; dependency_notes?: string | null;
};

export function TaskForm({
  action, clients, contents, members, values = {}, submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  clients: Option[]; contents: Option[]; members: Option[]; values?: TaskValues; submitLabel: string;
}) {
  return <form action={action} className="workspace-form">
    <label className="field-wide">Task title<Input name="title" required maxLength={160} defaultValue={values.title} placeholder="Describe the next action" /></label>
    <label>Category<Select name="category" defaultValue={values.category ?? "agency_task"}><option value="agency_task">Agency Task</option><option value="client_task">Client Task</option></Select></label>
    <label>Responsibility<Select name="responsibility" defaultValue={values.responsibility ?? "agency"}><option value="agency">Agency</option><option value="client">Client</option><option value="external">External</option></Select></label>
    <label>Client<Select name="client_id" defaultValue={values.client_id ?? ""}><option value="">No client</option>{clients.map(client => <option key={client.id} value={client.id}>{client.label}</option>)}</Select></label>
    <label>Related content<Select name="content_id" defaultValue={values.content_id ?? ""}><option value="">No content linked</option>{contents.map(content => <option key={content.id} value={content.id}>{content.label}</option>)}</Select></label>
    <label>Person responsible<Select name="assigned_to" required defaultValue={values.assigned_to ?? ""}><option value="" disabled>Select an active agency member</option>{members.map(member => <option key={member.id} value={member.id}>{member.label}</option>)}</Select></label>
    <label>Priority<Select name="priority" defaultValue={values.priority ?? "medium"}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></Select></label>
    <label>Status<Select name="status" defaultValue={values.status ?? "todo"}><option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="review">Review</option><option value="done">Done</option></Select></label>
    <label>Start date<Input type="date" name="start_date" defaultValue={values.start_date ?? ""} /></label>
    <label>Deadline<Input type="date" name="due_date" defaultValue={values.due_date ?? ""} /></label>
    <label className="field-wide">Description<Textarea name="description" rows={3} defaultValue={values.description ?? ""} maxLength={4000} /></label>
    <label className="field-wide">Dependencies or notes<Textarea name="dependency_notes" rows={2} defaultValue={values.dependency_notes ?? ""} maxLength={2000} /></label>
    <label className="field-wide checkbox-line"><input type="checkbox" name="reminder_enabled" defaultChecked={values.reminder_enabled ?? true} /> Email reminders (H-3, H-1, and 09:00 WIB on the deadline)</label>
    <div className="form-actions"><Button variant="primary" type="submit">{submitLabel}</Button></div>
  </form>;
}
