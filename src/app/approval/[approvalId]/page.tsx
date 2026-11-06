import Link from "next/link";
import { notFound } from "next/navigation";
import { reviewContentAction } from "@/app/actions/approval-actions";
import { ApprovalDecisionButton } from "@/components/approval-decision-button";
import { EmptyState, Textarea } from "@/components/ui";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SetupNotice } from "@/components/setup-notice";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";

const date = (value: string | null) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value)) : "—";
const title = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());

export const instant = false;

export default async function ApprovalDetailPage({ params, searchParams }: { params: Promise<{ approvalId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) return <SetupNotice />;
  const { approvalId } = await params;
  const query = await searchParams;
  const { data: approval, error } = await ctx.supabase.from("content_approvals").select("*").eq("id", approvalId).maybeSingle();
  if (error || !approval) notFound();
  const [{ data: content }, { data: history }, { data: revisions }, { data: schedule }] = await Promise.all([
    ctx.supabase.from("contents").select("id,title,client_id,content_type,platform,workflow_status,objective,brief,caption,notes,created_at,updated_at").eq("id", approval.content_id).maybeSingle(),
    ctx.supabase.from("content_approval_history").select("id,actor_id,old_status,new_status,old_feedback,new_feedback,created_at").eq("approval_id", approval.id).order("created_at", { ascending: true }).limit(100),
    ctx.supabase.from("content_revisions").select("id,revision_number,revision_notes,revised_by,created_at").eq("content_id", approval.content_id).order("revision_number", { ascending: true }).limit(100),
    ctx.supabase.from("content_schedules").select("id,platform,scheduled_at,publication_status").eq("content_id", approval.content_id).order("scheduled_at", { ascending: true }).limit(20),
  ]);
  if (!content) notFound();
  const [{ data: brief }, { data: storyboards }, { data: people }, { data: client }] = await Promise.all([
    ctx.supabase.from("content_creative_briefs").select("concept,creative_direction,key_message,visual_reference,production_notes").eq("content_id", content.id).maybeSingle(),
    ctx.supabase.from("content_storyboards").select("id,title,description").eq("content_id", content.id).order("created_at", { ascending: true }).limit(10),
    ctx.supabase.from("agency_members").select("id,full_name").eq("is_active", true).limit(300),
    ctx.supabase.from("clients").select("brand_name").eq("id", content.client_id).maybeSingle(),
  ]);
  const storyboardIds = (storyboards ?? []).map(row => row.id);
  const { data: storyboardRows } = storyboardIds.length ? await ctx.supabase.from("content_storyboard_rows").select("storyboard_id,sequence_no,scene,visual_description,shot_type,camera_movement,audio,dialogue,duration_seconds,notes").in("storyboard_id", storyboardIds).order("sequence_no") : { data: [] };
  const memberNames = new Map((people ?? []).map(row => [row.id, row.full_name]));
  const action = reviewContentAction.bind(null, approval.id);
  const isAssignedReviewer = approval.reviewer_id === ctx.user.id;
  const editable = approval.approval_status === "pending" && isAssignedReviewer;
  const message = typeof query.error === "string" ? query.error : "";

  return <WorkspaceShell title="Content review" section="Management / Approval / Review" memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <div className="workspace-page management-page">
      <header className="workspace-page-intro review-intro"><div><p><Link href="/approval">Approval queue</Link> / Content review</p><h2>{content.title}</h2><span className={`workspace-status-badge workspace-status-${approval.approval_status}`}>{title(approval.approval_status)}</span></div><Link className="ui-button ui-button-secondary" href={`/content/${content.id}`}>Open content record</Link></header>
      {query.saved === "1" && <p className="workspace-inline-success" role="status">Review decision saved.</p>}{message && <p className="workspace-inline-error" role="alert">{message}</p>}
      <div className="review-layout">
        <div className="review-main">
          <section className="workspace-panel"><div className="workspace-panel-header"><div><h2>Content information</h2><p>Read the production direction and publication details before deciding.</p></div></div><dl className="client-info-grid"><div><dt>Client</dt><dd>{client?.brand_name ?? "—"}</dd></div><div><dt>Content ID</dt><dd>{content.id}</dd></div><div><dt>Content type</dt><dd>{content.content_type}</dd></div><div><dt>Platform</dt><dd>{content.platform ?? "—"}</dd></div><div><dt>Submitted</dt><dd>{date(approval.submitted_at)}</dd></div><div><dt>Reviewed</dt><dd>{date(approval.reviewed_at)}</dd></div></dl><div className="review-copy"><h3>Creative brief</h3><p><strong>Objective:</strong> {content.objective || "—"}</p><p><strong>Brief:</strong> {content.brief || "—"}</p><p><strong>Concept:</strong> {brief?.concept || "—"}</p><p><strong>Creative direction:</strong> {brief?.creative_direction || "—"}</p><p><strong>Key message:</strong> {brief?.key_message || "—"}</p><p><strong>Caption:</strong> {content.caption || "—"}</p><p><strong>Production notes:</strong> {brief?.production_notes || content.notes || "—"}</p></div>{storyboards?.length ? <div className="review-copy"><h3>Storyboard</h3>{storyboards.map(board => <div key={board.id}><h4>{board.title}</h4><p>{board.description}</p><ol className="review-storyboard">{(storyboardRows ?? []).filter(row => row.storyboard_id === board.id).map(row => <li key={`${board.id}-${row.sequence_no}`}><strong>{row.sequence_no + 1}. {row.scene || "Scene"}</strong><p>{row.visual_description || row.dialogue || row.notes || "—"}</p><small>{[row.shot_type, row.camera_movement, row.audio, row.duration_seconds ? `${row.duration_seconds}s` : ""].filter(Boolean).join(" · ")}</small></li>)}</ol></div>)}</div> : <p className="workspace-note">No storyboard attached.</p>}</section>
          <section className="workspace-panel"><div className="workspace-panel-header"><div><h2>Publication schedule</h2></div></div>{schedule?.length ? <ul className="workspace-compact-list">{schedule.map(item => <li key={item.id}><span>{item.platform} · {title(item.publication_status)}</span><span>{date(item.scheduled_at)}</span></li>)}</ul> : <EmptyState title="No publication schedule">A schedule has not been added for this content.</EmptyState>}</section>
        </div>
        <aside className="review-side">
          <section className="workspace-panel"><h2>Review decision</h2><p className="workspace-note">Reviewer: {memberNames.get(approval.reviewer_id) ?? "Agency member"}</p>{approval.feedback && <blockquote className="review-feedback">{approval.feedback}</blockquote>}{editable ? <form action={action} className="review-decision-form"><label htmlFor="review-feedback">Feedback <span className="workspace-note">required for revision or rejection</span></label><Textarea id="review-feedback" name="feedback" rows={6} maxLength={4000} placeholder="Share clear feedback for the production team." /><div className="review-actions"><ApprovalDecisionButton className="ui-button ui-button-primary" decision="approved" confirmation="Approve this content? The decision will be recorded in review history.">Approve</ApprovalDecisionButton><ApprovalDecisionButton className="ui-button ui-button-secondary" decision="revision_requested" confirmation="Request a revision? The feedback will be saved to revision history.">Request revision</ApprovalDecisionButton><ApprovalDecisionButton className="ui-button ui-button-danger" decision="rejected" confirmation="Reject this content? The rejection and feedback will be retained in history.">Reject</ApprovalDecisionButton></div><p className="workspace-note">Revision and rejection require feedback. Approval may include an optional note.</p></form> : <p className="workspace-note">{approval.approval_status === "pending" ? "Only the assigned reviewer can submit a decision." : "This review is complete. Its history is retained below."}</p>}</section>
          <section className="workspace-panel"><h2>Revision history</h2>{revisions?.length ? <ol className="management-timeline">{revisions.map(row => <li key={row.id}><div><strong>Revision {row.revision_number}</strong><time>{date(row.created_at)}</time></div><p>{row.revision_notes}</p><small>{memberNames.get(row.revised_by) ?? "Agency member"}</small></li>)}</ol> : <p className="workspace-note">No revision history.</p>}</section>
          <section className="workspace-panel"><h2>Decision history</h2>{history?.length ? <ol className="management-timeline">{history.map(row => <li key={row.id}><div><strong>{title(row.old_status)} → {title(row.new_status)}</strong><time>{date(row.created_at)}</time></div><p>{row.new_feedback || "No feedback provided."}</p><small>{memberNames.get(row.actor_id ?? "") ?? "Agency member"}</small></li>)}</ol> : <p className="workspace-note">No previous decisions.</p>}</section>
        </aside>
      </div>
    </div>
  </WorkspaceShell>;
}
