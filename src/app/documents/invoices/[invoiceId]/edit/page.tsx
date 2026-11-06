export const instant = false;
import { notFound, redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SetupNotice } from "@/components/setup-notice";
import { InvoiceDraftForm } from "@/components/documents/invoice-draft-form";
import { saveInvoiceDraftAction } from "@/app/actions/document-actions";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";

export default async function EditInvoiceDraftPage({params}:{params:Promise<{invoiceId:string}>}){
  const ctx=await getActiveWorkspaceContext();if(!ctx)return <SetupNotice/>;
  const {invoiceId}=await params;
  const [{data:invoice,error},{data:clients},{data:profile}]=await Promise.all([
    ctx.supabase.from("invoices").select("id,invoice_number,client_id,client_package_id,status,invoice_date,due_date,service_period,service_period_start,service_period_end,discount,tax_rate,notes,created_by").eq("id",invoiceId).maybeSingle(),
    ctx.supabase.from("clients").select("id,brand_name").neq("status","archived").order("brand_name").limit(200),
    ctx.supabase.from("agency_billing_profiles").select("agency_name,address,email,phone,bank_name,bank_account_number,bank_account_holder,authorized_signatory,signatory_title,default_payment_terms,tax_configuration").eq("is_singleton",true).maybeSingle(),
  ]);
  if(error||!invoice)notFound();if(invoice.status!=="draft")redirect(`/documents/invoices/${invoiceId}`);if(invoice.created_by!==ctx.user.id)notFound();
  const {data:items}=await ctx.supabase.from("invoice_items").select("description,quantity,unit_price").eq("invoice_id",invoiceId).order("sort_order").limit(50);
  const initialDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const tax=profile?.tax_configuration as {enabled?:boolean;rate?:number}|null;
  return <WorkspaceShell title={`Edit ${invoice.invoice_number}`} section={`Documents / Invoice Generator / ${invoice.invoice_number} / Edit draft`} memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <div className="workspace-page invoice-create-page"><header className="workspace-page-intro"><div><p>Invoice Generator / {invoice.invoice_number}</p><h2>Edit invoice draft</h2></div></header><section className="workspace-panel"><InvoiceDraftForm clients={clients??[]} action={saveInvoiceDraftAction} initialDate={initialDate} billingProfile={profile} defaultTaxRate={tax?.enabled&&typeof tax.rate==="number"?tax.rate:0} seed={{invoice_id:invoice.id,invoice_number:invoice.invoice_number,client_id:invoice.client_id,client_package_id:invoice.client_package_id??"",invoice_date:invoice.invoice_date,due_date:invoice.due_date,service_period:invoice.service_period,service_period_start:invoice.service_period_start??"",service_period_end:invoice.service_period_end??"",discount:Number(invoice.discount),tax_rate:Number(invoice.tax_rate),notes:invoice.notes,items:(items??[]).map(item=>({description:item.description,quantity:Number(item.quantity),unit_price:Number(item.unit_price)}))}}/></section></div>
  </WorkspaceShell>;
}
