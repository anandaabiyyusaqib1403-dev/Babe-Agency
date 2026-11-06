export const instant = false;
import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SetupNotice } from "@/components/setup-notice";
import { InvoiceDraftForm } from "@/components/documents/invoice-draft-form";
import { saveInvoiceDraftAction } from "@/app/actions/document-actions";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";

export default async function NewInvoicePage(){
  const ctx=await getActiveWorkspaceContext();if(!ctx)return <SetupNotice/>;
  const [{data:clients},{data:profile,error:profileError}]=await Promise.all([
    ctx.supabase.from("clients").select("id,brand_name").neq("status","archived").order("brand_name").limit(200),
    ctx.supabase.from("agency_billing_profiles").select("agency_name,address,email,phone,bank_name,bank_account_number,bank_account_holder,authorized_signatory,signatory_title,default_payment_terms,tax_configuration").eq("is_singleton",true).maybeSingle(),
  ]);
  const billable=Boolean(profile&&!profileError&&profile.agency_name.trim()&&profile.address.trim()&&profile.bank_name.trim()&&profile.bank_account_number.trim()&&profile.bank_account_holder.trim());
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const defaultTaxRate=taxRate(profile?.tax_configuration);
  return <WorkspaceShell title="Create invoice" section="Documents / Invoice Generator / Create invoice" memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <div className="workspace-page invoice-create-page"><header className="workspace-page-intro"><div><p><Link href="/documents/invoices">Invoice Generator</Link> / New draft</p><h2>Create invoice draft</h2></div></header>
      {!billable&&<p className="workspace-inline-error" role="status">Billing profile belum lengkap. Lengkapi informasi agency dan rekening pada Billing Settings sebelum menerbitkan invoice. Jangan isi detail rekening dengan nilai perkiraan.</p>}
      {profileError&&<p className="workspace-inline-error" role="alert">Billing profile could not be checked.</p>}
      {clients?.length?<section className="workspace-panel"><InvoiceDraftForm clients={clients} action={saveInvoiceDraftAction} initialDate={date} billingProfile={profile} defaultTaxRate={defaultTaxRate}/></section>:<div className="workspace-panel"><div className="workspace-empty"><h3>No clients available</h3><p>Buat client terlebih dahulu sebelum menyiapkan invoice.</p></div></div>}
    </div>
  </WorkspaceShell>;
}

function taxRate(config:unknown){if(!config||typeof config!=="object"||Array.isArray(config))return 0;const value=config as Record<string,unknown>;if(value.enabled!==true||typeof value.rate!=="number"||value.rate<0||value.rate>1)return 0;return value.rate;}
