export const instant = false;
import { connection } from "next/server";
import Link from "next/link";
import { Button, Input, Select, Table } from "@/components/ui";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SetupNotice } from "@/components/setup-notice";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { restoreDocumentAction } from "@/app/actions/document-actions";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";

type Params = Record<string, string | string[] | undefined>;
const one = (params: Params, key: string) => typeof params[key] === "string" ? String(params[key]).slice(0, 120) : "";
const pageSize = 20;
const mimeTypes = ["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation","image/jpeg","image/png"];
type RelatedClient = { brand_name: string } | { brand_name: string }[] | null;
type RelatedMember = { full_name: string } | { full_name: string }[] | null;

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const ctx = await getActiveWorkspaceContext(); if (!ctx) return <SetupNotice />;
  const params = await searchParams;
  const q = one(params,"q"), category = one(params,"category"), clientId = one(params,"client_id"), mimeType = one(params,"mime_type"), invoiceId=one(params,"invoice_id");
  const archived = one(params,"archived") === "1";
  const page = Math.max(1, Math.min(10000, Number(one(params,"page")) || 1));
  const sort = ["name","category_id","size_bytes","uploaded_at"].includes(one(params,"sort")) ? one(params,"sort") : "uploaded_at";
  const ascending = one(params,"direction") === "asc";
  const safeQ = q.replace(/[%,()]/g," ").trim();
  const dateFrom = one(params,"date_from"), dateTo = one(params,"date_to");
  const recentSince = new Date(); recentSince.setDate(recentSince.getDate()-7);
  const [{ data: categories }, { data: clients }, { data: invoices }, { count: totalCount }, { count: archivedCount }, { count: recentCount }] = await Promise.all([
    ctx.supabase.from("document_categories").select("id,label,sort_order").order("sort_order").limit(50),
    ctx.supabase.from("clients").select("id,brand_name").neq("status","archived").order("brand_name").limit(200),
    ctx.supabase.from("invoices").select("id,invoice_number,client_id").neq("status","cancelled").order("created_at",{ascending:false}).limit(100),
    ctx.supabase.from("agency_documents").select("id",{count:"exact",head:true}).is("archived_at",null),
    ctx.supabase.from("agency_documents").select("id",{count:"exact",head:true}).not("archived_at","is",null),
    ctx.supabase.from("agency_documents").select("id",{count:"exact",head:true}).is("archived_at",null).gte("uploaded_at",recentSince.toISOString()),
  ]);
  let query = ctx.supabase.from("agency_documents").select("id,name,category_id,client_id,invoice_id,mime_type,size_bytes,uploaded_at,uploaded_by,drive_file_id,description,archived_at,archived_by,updated_at,clients(brand_name),agency_members(full_name),archived_actor:agency_members!agency_documents_archived_by_fkey(full_name)",{count:"exact"})
    .order(sort,{ascending, nullsFirst:false}).range((page-1)*pageSize,page*pageSize-1);
  query = archived ? query.not("archived_at","is",null) : query.is("archived_at",null);
  if (safeQ) query = query.ilike("name",`%${safeQ}%`);
  if (category && category !== "archive") query = query.eq("category_id",category);
  if (clientId) query = query.eq("client_id",clientId);
  if (mimeType) query = query.eq("mime_type",mimeType);
  if (dateFrom) query = query.gte("uploaded_at",`${dateFrom}T00:00:00+07:00`);
  if (dateTo) { const dayAfter = new Date(`${dateTo}T00:00:00+07:00`); dayAfter.setDate(dayAfter.getDate()+1); query = query.lt("uploaded_at",dayAfter.toISOString()); }
  const { data: documents, count, error } = await query;
  const totalPages = Math.max(1,Math.ceil((count??0)/pageSize));
  const activeParams = { q, category, client_id: clientId, mime_type: mimeType, date_from: dateFrom, date_to: dateTo, sort, direction: ascending?"asc":"desc", ...(archived?{archived:"1"}:{}) };
  const href = (changes: Partial<Record<string,string>>, nextPage = 1) => { const p = new URLSearchParams(); for (const [key,value] of Object.entries({...activeParams,...changes})) if (value) p.set(key,value); if (nextPage>1) p.set("page",String(nextPage)); return `/documents?${p.toString()}`; };
  const categoriesList = categories ?? [];
  const categoryCount = categoriesList.length;
  const actionResult = one(params,"result");
  const actionError = one(params,"error");
  const driveConfigurationPresent=Boolean(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID&&process.env.GOOGLE_DRIVE_CLIENT_ID&&process.env.GOOGLE_DRIVE_CLIENT_SECRET&&(process.env.GOOGLE_DRIVE_REFRESH_TOKEN_NEXT||process.env.GOOGLE_DRIVE_REFRESH_TOKEN)&&process.env.SUPABASE_SERVICE_ROLE_KEY);

  return <WorkspaceShell title="Document Center" section="Documents / Document Center" memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <div className="workspace-page documents-page">
      <header className="workspace-page-intro"><div><p>Kelola dokumen agency dan client dalam satu tempat.</p></div><div className="documents-header-actions"><Link className="ui-button" href="/documents/invoices">Invoice Generator</Link><a className="ui-button ui-button-primary" href="#upload-document">Upload document</a></div></header>
      <nav className="documents-tabs" aria-label="Documents sections"><Link href="/documents" aria-current={!archived?"page":undefined}>Document Center</Link><Link href="/documents/invoices">Invoice Generator</Link><Link href="/documents?archived=1" aria-current={archived?"page":undefined}>Archive</Link></nav>
      {actionError && <p className="workspace-inline-error" role="alert">{actionError}</p>}{actionResult === "document-archived" && <p className="workspace-inline-success" role="status">Dokumen diarsipkan. File Drive tetap tersimpan.</p>}{actionResult === "document-restored" && <p className="workspace-inline-success" role="status">Dokumen dipulihkan.</p>}
      <section className="documents-summary" aria-label="Document overview"><Summary label="Total documents" value={totalCount??0}/><Summary label="Categories" value={categoryCount}/><Summary label="Recent uploads · 7 days" value={recentCount??0}/><Summary label="Archived documents" value={archivedCount??0}/></section>
      <section className="workspace-panel" id="upload-document"><div className="workspace-panel-header"><div><h2>Upload document</h2><p>Upload langsung ke struktur folder Google Drive BABE AGENCY.</p></div></div>
        {driveConfigurationPresent ? <><p className="workspace-note">Drive connection is confirmed only after Google accepts each upload request.</p><DocumentUploadForm categories={categoriesList} clients={clients??[]} invoices={invoices??[]} selectedCategory={category&&category!=="archive"?category:"clients"} selectedInvoice={invoiceId}/></> : <p className="workspace-inline-error" role="status">Konfigurasi server Google Drive atau kredensial Supabase belum lengkap. Lengkapi GOOGLE_DRIVE_ROOT_FOLDER_ID, GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN, dan SUPABASE_SERVICE_ROLE_KEY.</p>}
      </section>
      <nav className="document-category-nav" aria-label="Document categories"><Link href={href({category:"",archived:""})} aria-current={!category&&!archived?"page":undefined}>All documents</Link>{categoriesList.filter(item=>item.id!=="archive").map(item=><Link key={item.id} href={href({category:item.id,archived:""})} aria-current={category===item.id&&!archived?"page":undefined}>{item.label}</Link>)}<Link href={href({category:"",archived:"1"})} aria-current={archived?"page":undefined}>Archive</Link></nav>
      <section className="workspace-panel"><form action="/documents" className="workspace-toolbar document-filter-form" role="search">
        {archived&&<input type="hidden" name="archived" value="1"/>}<label>Search documents<Input type="search" name="q" defaultValue={q} placeholder="Document name"/></label>
        <label>Category<Select name="category" defaultValue={category}><option value="">All categories</option>{categoriesList.filter(item=>item.id!=="archive").map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</Select></label>
        <label>Client<Select name="client_id" defaultValue={clientId}><option value="">All clients</option>{clients?.map(client=><option key={client.id} value={client.id}>{client.brand_name}</option>)}</Select></label>
        <label>File type<Select name="mime_type" defaultValue={mimeType}><option value="">All file types</option>{mimeTypes.map(mime=><option key={mime} value={mime}>{fileType(mime)}</option>)}</Select></label>
        <label>From<Input type="date" name="date_from" defaultValue={dateFrom}/></label><label>To<Input type="date" name="date_to" defaultValue={dateTo}/></label>
        <label>Sort by<Select name="sort" defaultValue={sort}><option value="uploaded_at">Upload date</option><option value="name">Name</option><option value="category_id">Category</option><option value="size_bytes">File size</option></Select></label><label>Direction<Select name="direction" defaultValue={ascending?"asc":"desc"}><option value="desc">Descending</option><option value="asc">Ascending</option></Select></label>
        <Button type="submit">Apply filters</Button><Link className="workspace-reset-link" href={archived?"/documents?archived=1":"/documents"}>Reset</Link>
      </form>
      <div className="workspace-panel-header"><div><h2>{archived?"Archived documents":"Documents"}</h2><p>{count??0} result · Page {page} of {totalPages}</p></div></div>
      {error?<p className="workspace-inline-error" role="alert">Daftar dokumen gagal dimuat. Coba refresh halaman.</p>:documents?.length?<Table label="Documents"><thead><tr><th>Document name</th><th>{archived?"Original category":"Category"}</th><th>Client</th>{archived?<><th>Archived by</th><th>Archived date</th></>:<><th>File type · size</th><th>Uploaded by</th><th>Upload date</th></>}<th>Action</th></tr></thead><tbody>{documents.map(document=>{const client=relatedName(document.clients as RelatedClient,"Agency");const member=relatedName(document.agency_members as RelatedMember,"Agency member");const archivedMember=relatedName(document.archived_actor as RelatedMember,"Agency member");return <tr key={document.id}><td><Link className="workspace-primary-link" href={`/documents/${document.id}`}>{document.name}</Link>{document.description&&<small className="document-description-cell">{document.description}</small>}</td><td>{categoriesList.find(item=>item.id===document.category_id)?.label??document.category_id}</td><td>{client}</td>{archived?<><td>{document.archived_by===ctx.user.id?"You":archivedMember}</td><td>{formatDate(document.archived_at??document.updated_at)}</td></>:<><td>{fileType(document.mime_type)}<small>{formatSize(Number(document.size_bytes))}</small></td><td>{document.uploaded_by===ctx.user.id?"You":member}</td><td>{formatDate(document.uploaded_at)}</td></>}<td>{archived?<form action={restoreDocumentAction.bind(null,document.id)}><ConfirmSubmitButton className="workspace-text-button" prompt={`Restore ${document.name}?`}>Restore</ConfirmSubmitButton></form>:<Link href={`/documents/${document.id}`}>Open details</Link>}</td></tr>;})}</tbody></Table>:<div className="workspace-empty"><h3>{archived?"No archived documents":"No documents found"}</h3><p>{archived?"Dokumen yang diarsipkan akan muncul di sini.":"Ubah filter atau unggah dokumen untuk mulai mengisi Document Center."}</p></div>}
      <nav className="workspace-pagination" aria-label="Document pagination"><span>{count??0} documents · Page {page} of {totalPages}</span><Link aria-disabled={page<=1} href={href({},Math.max(1,page-1))}>Previous</Link><Link aria-disabled={page>=totalPages} href={href({},Math.min(totalPages,page+1))}>Next</Link></nav>
      </section>
    </div>
  </WorkspaceShell>;
}

function Summary({label,value}:{label:string;value:number}){return <div className="documents-summary-item"><span>{label}</span><strong>{new Intl.NumberFormat("id-ID").format(value)}</strong></div>}
function relatedName(value:RelatedClient|RelatedMember,fallback:string){return Array.isArray(value)?(value[0] as {brand_name?:string;full_name?:string}|undefined)?.brand_name??(value[0] as {full_name?:string}|undefined)?.full_name??fallback:(value as {brand_name?:string;full_name?:string}|null)?.brand_name??(value as {full_name?:string}|null)?.full_name??fallback}
function formatDate(value:string){return new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeZone:"Asia/Jakarta"}).format(new Date(value))}
function formatSize(bytes:number){return bytes<1024*1024?`${(bytes/1024).toFixed(0)} KB`:`${(bytes/1024/1024).toFixed(2)} MB`}
function fileType(mime:string){return ({"application/pdf":"PDF","application/msword":"DOC","application/vnd.openxmlformats-officedocument.wordprocessingml.document":"DOCX","application/vnd.ms-excel":"XLS","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"XLSX","application/vnd.ms-powerpoint":"PPT","application/vnd.openxmlformats-officedocument.presentationml.presentation":"PPTX","image/jpeg":"JPEG","image/png":"PNG"} as Record<string,string>)[mime]??"File"}
