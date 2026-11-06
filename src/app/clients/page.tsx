import { connection } from "next/server";
import Link from "next/link";
import { Button, EmptyState, Input, Select, Table } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";
import { SetupNotice } from "@/components/setup-notice";
import { createWorkspaceClient, archiveWorkspaceClient } from "@/app/actions/workspace-actions";
import { ClientForm } from "@/components/workspace/client-form";

type Params = Record<string, string | string[] | undefined>;
const states = ["lead", "active", "inactive", "archived"] as const;
const pageSize = 20;
const value = (params: Params, key: string) => typeof params[key] === "string" ? String(params[key]).slice(0, 120) : "";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const ctx = await getActiveWorkspaceContext(); if (!ctx) return <SetupNotice />;
  const params = await searchParams, q = value(params, "q"), status = value(params, "status"), industry = value(params, "industry");
  const sortKey = ["brand_name", "status", "created_at"].includes(value(params, "sort")) ? value(params, "sort") : "brand_name";
  const direction = value(params, "direction") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Math.min(10000, Number(value(params, "page")) || 1));
  const searchSafe = q.replace(/[%,()]/g, " ").trim();
  let query = ctx.supabase.from("clients").select("id,client_name,brand_name,contact_person,email,phone,industry,status,created_at", { count: "exact" }).is("deleted_at", null).order(sortKey, { ascending: direction === "asc" }).range((page - 1) * pageSize, page * pageSize - 1);
  if (states.includes(status as typeof states[number])) query = query.eq("status", status);
  if (industry) query = query.eq("industry", industry);
  if (searchSafe) query = query.or(`brand_name.ilike.%${searchSafe}%,client_name.ilike.%${searchSafe}%,contact_person.ilike.%${searchSafe}%`);
  const [{ data: clients, count, error }, summaries, industryResult] = await Promise.all([
    query,
    Promise.all(states.map(s => ctx.supabase.from("clients").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", s))),
    ctx.supabase.from("clients").select("industry").is("deleted_at", null).not("industry", "is", null).order("industry").limit(200),
  ]);
  const ids = (clients ?? []).map(row => row.id);
  const packageResult = ids.length ? await ctx.supabase.from("client_packages").select("id,client_id,package_name_snapshot,start_date,end_date,status").in("client_id", ids).eq("status", "active").order("start_date", { ascending: false }).limit(pageSize * 3) : { data: [], error: null };
  const currentPackage = new Map<string, NonNullable<typeof packageResult.data>[number]>();
  for (const row of packageResult.data ?? []) if (!currentPackage.has(row.client_id)) currentPackage.set(row.client_id, row);
  const industries = [...new Set((industryResult.data ?? []).map(row => row.industry).filter((x): x is string => Boolean(x)))];
  const pages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const href = (nextPage: number) => { const p = new URLSearchParams(); for (const [key, v] of [["q", q], ["status", status], ["industry", industry], ["sort", sortKey], ["direction", direction]] as const) if (v) p.set(key, v); p.set("page", String(nextPage)); return `/clients?${p.toString()}`; };
  const date = (v: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(v));

  return <WorkspaceShell title="Client Portfolio" section="Studio / Client Portfolio" memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <div className="workspace-page">
      <header className="workspace-page-intro"><div><p>Kelola hubungan client, paket layanan, dan strategi konten.</p></div><a className="ui-button ui-button-primary" href="#add-client">Add Client</a></header>
      <div className="client-summary" aria-label="Client summary">{["Total clients", "Active", "Leads", "Inactive"].map((label, index) => <div className="client-summary-item" key={label}><span>{label}</span><strong>{index === 0 ? number(states.reduce((total, _, i) => total + (summaries[i].count ?? 0), 0)) : number(summaries[index].count)}</strong></div>)}</div>
      <details id="add-client" className="workspace-panel client-create-panel"><summary className="workspace-summary">Add new client</summary><div className="workspace-form-wrap"><ClientForm action={createWorkspaceClient} submitLabel="Save Client" /></div></details>
      {(params.saved || params.error) && <p className={params.error ? "workspace-feedback workspace-feedback-error" : "workspace-feedback"} role="status">{params.error ? String(params.error) : "Client berhasil disimpan."}</p>}
      <section className="workspace-panel client-list-panel" aria-labelledby="client-list-heading">
        <div className="workspace-panel-header"><div><h2 id="client-list-heading">All clients</h2><p>{number(count)} client ditemukan</p></div></div>
        <form className="workspace-toolbar client-filter-form" action="/clients" role="search">
          <label>Search client<Input type="search" name="q" defaultValue={q} placeholder="Brand, nama client, contact" /></label>
          <label>Status<Select name="status" defaultValue={status}><option value="">Semua status</option>{states.map(s => <option key={s} value={s}>{title(s)}</option>)}</Select></label>
          <label>Industry<Select name="industry" defaultValue={industry}><option value="">Semua industri</option>{industries.map(v => <option key={v} value={v}>{v}</option>)}</Select></label>
          <label>Sort by<Select name="sort" defaultValue={sortKey}><option value="brand_name">Brand name</option><option value="status">Status</option><option value="created_at">Created at</option></Select></label>
          <label>Order<Select name="direction" defaultValue={direction}><option value="asc">Ascending</option><option value="desc">Descending</option></Select></label>
          <input type="hidden" name="page" value="1" /><Button type="submit">Apply filters</Button><Link className="workspace-reset-link" href="/clients">Reset</Link>
        </form>
        {error || packageResult.error ? <p className="workspace-inline-error" role="alert">Client list gagal dimuat. Refresh halaman atau periksa koneksi.</p> : clients?.length ? <Table label="Clients"><thead><tr><th>Client / Brand</th><th>Contact person</th><th>Package</th><th>Service period</th><th>Status</th><th>Created at</th><th>Actions</th></tr></thead><tbody>{clients.map(client => { const pkg = currentPackage.get(client.id); return <tr key={client.id}>
          <td><Link className="workspace-primary-link" href={`/clients/${client.id}`}>{client.brand_name}</Link><small>{client.client_name || client.brand_name}</small></td><td>{client.contact_person || "—"}</td><td>{pkg?.package_name_snapshot || "Belum ada paket"}</td><td>{pkg ? `${date(pkg.start_date)} - ${pkg.end_date ? date(pkg.end_date) : "Berjalan"}` : "—"}</td><td><span className={`workspace-status-badge workspace-status-${client.status}`}>{title(client.status)}</span></td><td>{date(client.created_at)}</td><td><div className="workspace-row-actions"><Link href={`/clients/${client.id}/edit`}>Edit</Link><Link href={`/clients/${client.id}`}>Detail</Link>{client.status !== "archived" && <form action={archiveWorkspaceClient.bind(null, client.id)}><ConfirmSubmitButton className="workspace-text-button" prompt={`Arsipkan ${client.brand_name}? Riwayat pekerjaan akan tetap tersimpan.`}>Archive</ConfirmSubmitButton></form>}</div></td>
        </tr>; })}</tbody></Table> : <EmptyState title="Client belum ditemukan">Ubah pencarian atau filter, atau tambahkan client baru.</EmptyState>}
        <nav className="workspace-pagination" aria-label="Pagination"><span>Page {page} dari {pages}</span><Link aria-disabled={page <= 1} href={href(Math.max(1, page - 1))}>Sebelumnya</Link><Link aria-disabled={page >= pages} href={href(Math.min(pages, page + 1))}>Berikutnya</Link></nav>
      </section>
    </div>
  </WorkspaceShell>;
}

function number(value: number | null | undefined) { return new Intl.NumberFormat("id-ID").format(value ?? 0); }
function title(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
