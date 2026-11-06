import Link from "next/link";
import { EmptyState, Input, Select, Table } from "@/components/ui";
import { Button } from "@/components/ui";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SetupNotice } from "@/components/setup-notice";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";
import { submitContentForReviewAction } from "@/app/actions/approval-actions";

const title = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
const date = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));

export const instant = false;

export default async function ApprovalPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) return <SetupNotice />;
  const params = await searchParams;
  const one = (key: string) => typeof params[key] === "string" ? String(params[key]).slice(0, 120) : "";
  const q = one("q"), status = one("status");
  const page = Math.max(1, Math.min(1000, Number(one("page")) || 1));
  const approvalStatuses = ["pending", "approved", "revision_requested", "rejected"];
  const matchingContentIds = q
    ? await (async () => {
        const [{ data: titleMatches }, { data: clientMatches }] = await Promise.all([
          ctx.supabase.from("contents").select("id").is("deleted_at", null).ilike("title", `%${q}%`).limit(5000),
          ctx.supabase.from("clients").select("id").ilike("brand_name", `%${q}%`).limit(5000),
        ]);
        const clientIds = (clientMatches ?? []).map(client => client.id);
        const { data: clientContent } = clientIds.length
          ? await ctx.supabase.from("contents").select("id").is("deleted_at", null).in("client_id", clientIds).limit(5000)
          : { data: [] };
        return [...new Set([...(titleMatches ?? []).map(content => content.id), ...(clientContent ?? []).map(content => content.id)])];
      })()
    : null;
  let approvalQuery = ctx.supabase.from("content_approvals").select("id,content_id,reviewer_id,approval_status,submitted_at,reviewed_at,created_by", { count: "exact" }).order("submitted_at", { ascending: false });
  if (approvalStatuses.includes(status)) approvalQuery = approvalQuery.eq("approval_status", status);
  if (matchingContentIds) approvalQuery = matchingContentIds.length ? approvalQuery.in("content_id", matchingContentIds) : approvalQuery.eq("content_id", "00000000-0000-0000-0000-000000000000");
  const [{ data: approvals, count, error }, { data: members }, { data: readyContent }, pendingCount, revisionCount, approvedCount, rejectedCount] = await Promise.all([
    approvalQuery.range((page - 1) * 30, page * 30 - 1),
    ctx.supabase.from("agency_members").select("id,full_name").eq("is_active", true).order("full_name").limit(200),
    ctx.supabase.from("contents").select("id,title,workflow_status").in("workflow_status", ["internal_review", "client_review", "review", "production", "in_production"]).is("deleted_at", null).order("updated_at", { ascending: false }).limit(200),
    ctx.supabase.from("content_approvals").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
    ctx.supabase.from("content_approvals").select("id", { count: "exact", head: true }).eq("approval_status", "revision_requested"),
    ctx.supabase.from("content_approvals").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
    ctx.supabase.from("content_approvals").select("id", { count: "exact", head: true }).eq("approval_status", "rejected"),
  ]);
  const visible = approvals ?? [];
  const contentIds = [...new Set(visible.map(row => row.content_id))];
  const [{ data: content }] = await Promise.all([
    contentIds.length ? ctx.supabase.from("contents").select("id,title,client_id,content_type,platform,workflow_status").in("id", contentIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const clientIds = [...new Set((content ?? []).map(row => row.client_id))];
  const { data: clients } = clientIds.length ? await ctx.supabase.from("clients").select("id,brand_name").in("id", clientIds) : { data: [] };
  const contentById = new Map((content ?? []).map(row => [row.id, row]));
  const clientById = new Map((clients ?? []).map(row => [row.id, row.brand_name]));
  const memberById = new Map((members ?? []).map(row => [row.id, row.full_name]));
  const counts = new Map<string, number>([["pending", pendingCount.count ?? 0], ["revision_requested", revisionCount.count ?? 0], ["approved", approvedCount.count ?? 0], ["rejected", rejectedCount.count ?? 0]]);
  return <WorkspaceShell title="Approval" section="Management / Approval" memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <div className="workspace-page management-page">
      <header className="workspace-page-intro management-intro"><div><p>Review konten dan pantau keputusan tim dalam satu antrean.</p></div></header>
      {one("error") && <p className="workspace-inline-error" role="alert">{one("error")}</p>}
      <details className="workspace-panel approval-submit"><summary className="workspace-summary">Submit content for review</summary><form action={submitContentForReviewAction} className="workspace-toolbar"><label>Content<Select name="content_id" required defaultValue=""><option value="" disabled>Choose content in review</option>{readyContent?.map(item => <option key={item.id} value={item.id}>{item.title} · {title(item.workflow_status)}</option>)}</Select></label><label>Reviewer<Select name="reviewer_id" required defaultValue=""><option value="" disabled>Choose reviewer</option>{members?.map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}</Select></label><Button variant="primary" type="submit">Submit for review</Button></form></details>
      <section className="management-summary" aria-label="Approval overview">
        {[ ["Pending review", counts.get("pending") ?? 0], ["Internal review", (readyContent ?? []).filter(row => row.workflow_status === "internal_review").length], ["Client review", (readyContent ?? []).filter(row => row.workflow_status === "client_review").length], ["Revision required", counts.get("revision_requested") ?? 0], ["Approved", counts.get("approved") ?? 0] ].map(([label, value]) => <div className="management-metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </section>
      <section className="workspace-panel">
        <div className="workspace-panel-header"><div><h2>Review queue</h2><p>{count ?? 0} approval records · newest first</p></div></div>
        <form className="workspace-toolbar management-filter" action="/approval" role="search"><label>Search<Input name="q" type="search" defaultValue={q} placeholder="Content or client" /></label><label>Status<Select name="status" defaultValue={status}><option value="">All statuses</option>{["pending", "approved", "revision_requested", "rejected"].map(value => <option value={value} key={value}>{title(value)}</option>)}</Select></label><button className="ui-button ui-button-secondary" type="submit">Filter</button><Link className="ui-button ui-button-quiet" href="/approval">Clear</Link></form>
        {error || pendingCount.error || revisionCount.error || approvedCount.error || rejectedCount.error ? <p className="workspace-inline-error" role="alert">Approval queue could not be loaded. Refresh and try again.</p> : visible.length ? <Table label="Approval review queue"><thead><tr><th>Content</th><th>Client</th><th>Type · Platform</th><th>Submitted by</th><th>Submitted</th><th>Reviewer</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map(row => { const item = contentById.get(row.content_id); return <tr key={row.id}><td><strong>{item?.title ?? "Content unavailable"}</strong></td><td>{clientById.get(item?.client_id ?? "") ?? "—"}</td><td>{item ? `${item.content_type} · ${item.platform ?? "—"}` : "—"}</td><td>{memberById.get(row.created_by) ?? "Agency member"}</td><td>{date(row.submitted_at)}</td><td>{memberById.get(row.reviewer_id) ?? "Agency member"}</td><td><span className={`workspace-status-badge workspace-status-${row.approval_status}`}>{title(row.approval_status)}</span></td><td><Link className="workspace-primary-link" href={`/approval/${row.id}`}>Review</Link></td></tr>; })}</tbody></Table> : <EmptyState title={q || status ? "No approvals match" : "No approval items yet"}>{q || status ? "Change the search or status filter." : "Items submitted for review will appear here."}</EmptyState>}
        {(count ?? 0) > 30 && <nav className="workspace-pagination" aria-label="Approval pages"><span>Page {page} of {Math.ceil((count ?? 0) / 30)}</span>{page > 1 && <Link className="ui-button" href={`/approval?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}`}>Previous</Link>}{page * 30 < (count ?? 0) && <Link className="ui-button" href={`/approval?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}`}>Next</Link>}</nav>}
      </section>
    </div>
  </WorkspaceShell>;
}
