export const instant = false;
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SetupNotice } from "@/components/setup-notice";
import { archiveDocumentAction, restoreDocumentAction, updateDocumentMetadataAction } from "@/app/actions/document-actions";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";

export default async function DocumentDetailPage({params,searchParams}:{params:Promise<{documentId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const ctx=await getActiveWorkspaceContext();if(!ctx)return <SetupNotice/>;
  const [{documentId},query]=await Promise.all([params,searchParams]);
  const {data:document,error}=await ctx.supabase.from("agency_documents").select("id,name,description,category_id,client_id,invoice_id,drive_file_id,drive_folder_id,web_view_link,mime_type,size_bytes,uploaded_by,uploaded_at,updated_at,archived_at,clients(brand_name),agency_members(full_name)").eq("id",documentId).maybeSingle();
  if(error||!document)notFound();
  const [{data:categories},{data:clients},{data:invoices},{data:events}]=await Promise.all([
    ctx.supabase.from("document_categories").select("id,label").order("sort_order").limit(50),
    ctx.supabase.from("clients").select("id,brand_name").neq("status","archived").order("brand_name").limit(200),
    ctx.supabase.from("invoices").select("id,invoice_number,client_id").neq("status","cancelled").order("created_at",{ascending:false}).limit(100),
    ctx.supabase.from("agency_document_events").select("id,event_type,created_at,details,agency_members(full_name)").eq("document_id",documentId).order("created_at",{ascending:false}).limit(20),
  ]);
  const isPdf=document.mime_type==="application/pdf",isImage=document.mime_type.startsWith("image/");
  const relatedClient=relatedName(document.clients as unknown as {brand_name:string}|{brand_name:string}[]|null);const memberRelation=document.agency_members as unknown as {full_name:string}|{full_name:string}[]|null;const relatedMember=Array.isArray(memberRelation)?memberRelation[0]?.full_name:memberRelation?.full_name;
  const result=typeof query.result==="string"?query.result:"",errorMessage=typeof query.error==="string"?query.error:"";
  return <WorkspaceShell title="Document detail" section={`Documents / Document Center / ${document.name}`} memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <div className="workspace-page document-detail-page">
      <header className="workspace-page-intro"><div><p><Link href="/documents">Document Center</Link> / {relatedClient}</p><h2>{document.name}</h2><span className={`workspace-status-badge ${document.archived_at?"workspace-status-cancelled":"workspace-status-active"}`}>{document.archived_at?"Archived":"Active"}</span></div><div className="documents-header-actions">{document.web_view_link&&<a className="ui-button" href={document.web_view_link} target="_blank" rel="noreferrer">Open in Google Drive</a>}<a className="ui-button ui-button-primary" href={`/api/documents/${document.id}?download=1`}>Download</a></div></header>
      {errorMessage&&<p className="workspace-inline-error" role="alert">{errorMessage}</p>}{result==="metadata-updated"&&<p className="workspace-inline-success" role="status">Metadata updated.</p>}
      <div className="document-detail-grid"><section className="workspace-panel document-preview-panel"><div className="workspace-panel-header"><div><h2>Preview</h2><p>{isPdf||isImage?"Preview served from the authorized Drive connection.":"Preview is not available for this file type."}</p></div></div>{isPdf?<iframe className="document-preview-frame" src={`/api/documents/${document.id}`} title={`PDF preview for ${document.name}`}/>:isImage?<Image unoptimized width={1200} height={900} className="document-image-preview" src={`/api/documents/${document.id}`} alt={document.name}/>:<div className="workspace-empty"><h3>No preview available</h3><p>Open the file in Google Drive or download a local copy to view it.</p></div>}</section>
        <aside className="workspace-panel document-information-panel"><h2>Document information</h2><dl className="document-detail-list"><div><dt>Category</dt><dd>{categories?.find(item=>item.id===document.category_id)?.label??document.category_id}</dd></div><div><dt>Client</dt><dd>{relatedClient}</dd></div><div><dt>Invoice</dt><dd>{document.invoice_id?<Link href={`/documents/invoices/${document.invoice_id}`}>{invoices?.find(item=>item.id===document.invoice_id)?.invoice_number??"Open invoice"}</Link>:"—"}</dd></div><div><dt>File type</dt><dd>{document.mime_type}</dd></div><div><dt>File size</dt><dd>{formatSize(Number(document.size_bytes))}</dd></div><div><dt>Uploaded by</dt><dd>{document.uploaded_by===ctx.user.id?"You":relatedMember??"Agency member"}</dd></div><div><dt>Uploaded at</dt><dd>{formatDate(document.uploaded_at)}</dd></div><div><dt>Last updated</dt><dd>{formatDate(document.updated_at)}</dd></div><div><dt>Google Drive file ID</dt><dd className="document-id-value">{document.drive_file_id??"Not available"}</dd></div><div><dt>Drive folder ID</dt><dd className="document-id-value">{document.drive_folder_id??"Not available"}</dd></div></dl>
          <details className="document-edit-details"><summary className="workspace-summary">Edit metadata</summary><form action={updateDocumentMetadataAction.bind(null,document.id)} className="workspace-form"><label>Document name<Input name="name" defaultValue={document.name} maxLength={255} required/></label><label>Related client<Select name="client_id" defaultValue={document.client_id??""}><option value="">Agency document</option>{clients?.map(client=><option key={client.id} value={client.id}>{client.brand_name}</option>)}</Select></label><label>Related invoice<Select name="invoice_id" defaultValue={document.invoice_id??""}><option value="">No invoice</option>{invoices?.map(invoice=><option key={invoice.id} value={invoice.id}>{invoice.invoice_number}</option>)}</Select></label><label>Description<Textarea name="description" defaultValue={document.description??""} maxLength={2000} rows={3}/></label><Button type="submit">Save metadata</Button></form></details>
          {document.archived_at?<form action={restoreDocumentAction.bind(null,document.id)}><ConfirmSubmitButton prompt={`Restore ${document.name}?`}>Restore document</ConfirmSubmitButton></form>:<form action={archiveDocumentAction.bind(null,document.id)}><ConfirmSubmitButton prompt={`Archive ${document.name}? The Drive file will remain stored.`}>Archive document</ConfirmSubmitButton></form>}
        </aside></div>
      <section className="workspace-panel"><div className="workspace-panel-header"><div><h2>Document activity</h2><p>Metadata changes do not delete the Google Drive file.</p></div></div>{events?.length?<ol className="document-activity-list">{events.map(event=><li key={event.id}><strong>{event.event_type.replaceAll("_"," ")}</strong><time>{formatDate(event.created_at)}</time><span>{memberFullName(event.agency_members)}</span></li>)}</ol>:<p className="workspace-note">No activity history yet.</p>}</section>
    </div>
  </WorkspaceShell>;
}

function relatedName(value:{brand_name:string}|{brand_name:string}[]|null){return Array.isArray(value)?value[0]?.brand_name??"Agency":value?.brand_name??"Agency"}
function memberFullName(value:unknown){const member=value as {full_name?:string}|{full_name?:string}[]|null;return Array.isArray(member)?member[0]?.full_name??"Agency member":member?.full_name??"Agency member"}
function formatDate(value:string){return new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Jakarta"}).format(new Date(value))}
function formatSize(bytes:number){return bytes<1024*1024?`${(bytes/1024).toFixed(0)} KB`:`${(bytes/1024/1024).toFixed(2)} MB`}
