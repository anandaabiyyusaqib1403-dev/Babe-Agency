export const instant = false;
import Link from "next/link";
import { Button, EmptyState, Input, Select, Table } from "@/components/ui";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SetupNotice } from "@/components/setup-notice";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";

type Params=Record<string,string|string[]|undefined>;
const one=(p:Params,k:string)=>typeof p[k]==="string"?String(p[k]).slice(0,120):"";
const size=20;
const statuses=["draft","issued","partially_paid","paid","overdue","cancelled"];
type RelatedClient={brand_name:string}|{brand_name:string}[]|null;

export default async function InvoiceOverviewPage({searchParams}:{searchParams:Promise<Params>}){
  const ctx=await getActiveWorkspaceContext();if(!ctx)return <SetupNotice/>;
  const params=await searchParams;const q=one(params,"q"),clientId=one(params,"client_id"),status=one(params,"status"),from=one(params,"date_from"),to=one(params,"date_to");const sortCandidate=one(params,"sort");const sort=["created_at","invoice_number","invoice_date","due_date","total_amount","remaining_amount","status"].includes(sortCandidate)?sortCandidate:"created_at";const ascending=one(params,"direction")==="asc";
  const page=Math.max(1,Math.min(10000,Number(one(params,"page"))||1));const safeQ=q.replace(/[%,()]/g," ").trim();
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const [{data:clients},{count:total},{count:draft},{count:issued},{count:partial},{count:paid},{count:overdue}]=await Promise.all([
    ctx.supabase.from("clients").select("id,brand_name").order("brand_name").limit(200),
    ctx.supabase.from("invoices").select("id",{count:"exact",head:true}),
    ctx.supabase.from("invoices").select("id",{count:"exact",head:true}).eq("status","draft"),
    ctx.supabase.from("invoices").select("id",{count:"exact",head:true}).eq("status","issued"),
    ctx.supabase.from("invoices").select("id",{count:"exact",head:true}).eq("status","partially_paid"),
    ctx.supabase.from("invoices").select("id",{count:"exact",head:true}).eq("status","paid"),
    ctx.supabase.from("invoices").select("id",{count:"exact",head:true}).in("status",["issued","partially_paid","overdue"]).lt("due_date",today).gt("remaining_amount",0),
  ]);
  let query=ctx.supabase.from("invoices").select("id,invoice_number,status,invoice_date,due_date,service_period,total_amount,paid_amount,remaining_amount,created_at,clients(brand_name)",{count:"exact"}).order(sort,{ascending,nullsFirst:false});
  if(safeQ)query=query.ilike("invoice_number",`%${safeQ}%`);if(clientId)query=query.eq("client_id",clientId);
  if(status==="overdue")query=query.in("status",["issued","partially_paid","overdue"]).lt("due_date",today).gt("remaining_amount",0);else if(status&&statuses.includes(status))query=query.eq("status",status);
  if(from)query=query.gte("invoice_date",from);if(to)query=query.lte("invoice_date",to);
  const {data:invoices,count,error}=await query.range((page-1)*size,page*size-1);
  const pages=Math.max(1,Math.ceil((count??0)/size));
  const makeHref=(nextPage:number)=>{const p=new URLSearchParams();for(const [key,value] of [["q",q],["client_id",clientId],["status",status],["date_from",from],["date_to",to],["sort",sort],["direction",ascending?"asc":"desc"]] as const)if(value)p.set(key,value);if(nextPage>1)p.set("page",String(nextPage));return `/documents/invoices?${p.toString()}`};
  const result=one(params,"result"),message=one(params,"error");
  return <WorkspaceShell title="Invoice Generator" section="Documents / Invoice Generator" memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <div className="workspace-page invoice-overview-page"><header className="workspace-page-intro"><div><p>Terbitkan invoice dan pantau pembayaran client.</p></div><Link className="ui-button ui-button-primary" href="/documents/invoices/new">Create invoice</Link></header>
      <nav className="documents-tabs" aria-label="Documents sections"><Link href="/documents">Document Center</Link><Link href="/documents/invoices" aria-current="page">Invoice Generator</Link></nav>
      {message&&<p className="workspace-inline-error" role="alert">{message}</p>}{result==="draft-saved"&&<p className="workspace-inline-success" role="status">Invoice draft saved.</p>}
      <section className="invoice-summary-grid" aria-label="Invoice overview"><Summary label="Total invoices" value={total??0}/><Summary label="Draft" value={draft??0}/><Summary label="Issued" value={issued??0}/><Summary label="Partially paid" value={partial??0}/><Summary label="Paid" value={paid??0}/><Summary label="Overdue" value={overdue??0}/></section>
      <section className="workspace-panel"><form className="workspace-toolbar invoice-filter-form" action="/documents/invoices" role="search"><label>Search invoice<Input type="search" name="q" defaultValue={q} placeholder="Invoice number"/></label><label>Client<Select name="client_id" defaultValue={clientId}><option value="">All clients</option>{clients?.map(client=><option key={client.id} value={client.id}>{client.brand_name}</option>)}</Select></label><label>Status<Select name="status" defaultValue={status}><option value="">All statuses</option>{statuses.map(item=><option key={item} value={item}>{title(item)}</option>)}</Select></label><label>From<Input type="date" name="date_from" defaultValue={from}/></label><label>To<Input type="date" name="date_to" defaultValue={to}/></label><label>Sort by<Select name="sort" defaultValue={sort}><option value="created_at">Created date</option><option value="invoice_number">Invoice number</option><option value="invoice_date">Invoice date</option><option value="due_date">Due date</option><option value="total_amount">Total amount</option><option value="remaining_amount">Balance</option><option value="status">Status</option></Select></label><label>Direction<Select name="direction" defaultValue={ascending?"asc":"desc"}><option value="desc">Descending</option><option value="asc">Ascending</option></Select></label><Button type="submit">Apply filters</Button><Link className="workspace-reset-link" href="/documents/invoices">Reset</Link></form>
        <div className="workspace-panel-header"><div><h2>Invoices</h2><p>{count??0} result · Page {page} of {pages}</p></div></div>
        {error?<p className="workspace-inline-error" role="alert">Invoice list failed to load.</p>:invoices?.length?<Table label="Invoices"><thead><tr><th>Invoice number</th><th>Client</th><th>Invoice date</th><th>Due date</th><th>Service period</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead><tbody>{invoices.map(invoice=>{const displayStatus=invoice.status!=="paid"&&invoice.status!=="cancelled"&&invoice.due_date<today&&Number(invoice.remaining_amount)>0?"overdue":invoice.status;return <tr key={invoice.id}><td><Link className="workspace-primary-link" href={`/documents/invoices/${invoice.id}`}>{invoice.invoice_number}</Link></td><td>{clientName(invoice.clients)}</td><td>{date(invoice.invoice_date)}</td><td>{date(invoice.due_date)}</td><td>{invoice.service_period||"—"}</td><td>{money(Number(invoice.total_amount??0))}</td><td>{money(Number(invoice.paid_amount??0))}</td><td>{money(Number(invoice.remaining_amount??0))}</td><td><span className={`workspace-status-badge workspace-status-${displayStatus}`}>{title(displayStatus)}</span></td><td><Link href={`/documents/invoices/${invoice.id}`}>Open</Link></td></tr>})}</tbody></Table>:<EmptyState title="No invoices yet">Create a draft when a client and the service items are ready.</EmptyState>}
        <nav className="workspace-pagination" aria-label="Invoice pagination"><span>{count??0} invoices · Page {page} of {pages}</span><Link aria-disabled={page<=1} href={makeHref(Math.max(1,page-1))}>Previous</Link><Link aria-disabled={page>=pages} href={makeHref(Math.min(pages,page+1))}>Next</Link></nav>
      </section>
    </div>
  </WorkspaceShell>;
}
function Summary({label,value}:{label:string;value:number}){return <div className="documents-summary-item"><span>{label}</span><strong>{new Intl.NumberFormat("id-ID").format(value)}</strong></div>}
function clientName(value:RelatedClient){return Array.isArray(value)?value[0]?.brand_name??"Client":value?.brand_name??"Client"}
function title(value:string){return value.replaceAll("_"," ").replace(/(^|\s)\S/g,letter=>letter.toUpperCase())}
function date(value:string){return new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeZone:"Asia/Jakarta"}).format(new Date(`${value}T00:00:00+07:00`))}
function money(value:number){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:2}).format(value)}
