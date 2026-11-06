"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";
import { getGoogleDriveAccessToken } from "@/lib/google-drive";

const value = (form: FormData, key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
function fail(path: string, message: string): never { redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`); }
function saved(path: string, result: string): never { redirect(`${path}${path.includes("?") ? "&" : "?"}result=${encodeURIComponent(result)}`); }
function refreshDocuments() { revalidatePath("/documents"); revalidatePath("/documents/invoices"); }

export async function updateDocumentMetadataAction(documentId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const parsed = z.object({ name: z.string().trim().min(1).max(255), description: z.string().max(2000), client_id: z.union([z.literal(""), z.string().uuid()]), invoice_id: z.union([z.literal(""), z.string().uuid()]) }).safeParse(Object.fromEntries(["name","description","client_id","invoice_id"].map(key => [key, value(form,key)])));
  if (!parsed.success) fail(`/documents/${documentId}`, "Periksa nama, deskripsi, dan relasi dokumen.");
  const { data: current } = await ctx.supabase.from("agency_documents").select("name,description,drive_file_id").eq("id",documentId).maybeSingle();
  if (!current) fail(`/documents/${documentId}`,"Dokumen tidak ditemukan.");
  let driveChanged = false;
  if (current.drive_file_id) {
    let accessToken: string;
    try { accessToken = await getGoogleDriveAccessToken(); }
    catch { fail(`/documents/${documentId}`,"Otorisasi Google Drive perlu diperbarui; metadata belum diubah."); }
    const driveResponse=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(current.drive_file_id)}?fields=id,name,description`,{method:"PATCH",headers:{Authorization:`Bearer ${accessToken!}`,"content-type":"application/json"},body:JSON.stringify({name:parsed.data.name,description:parsed.data.description}),cache:"no-store"});
    if(!driveResponse.ok)fail(`/documents/${documentId}`,"File Drive tidak dapat diperbarui; metadata belum diubah.");
    driveChanged=true;
  }
  const { error } = await ctx.supabase.rpc("update_agency_document_metadata", { p_document_id: documentId, p_name: parsed.data.name, p_description: parsed.data.description, p_client_id: parsed.data.client_id || null, p_invoice_id: parsed.data.invoice_id || null });
  if (error) {
    if(driveChanged&&current.drive_file_id){
      try { const accessToken=await getGoogleDriveAccessToken(); await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(current.drive_file_id)}`,{method:"PATCH",headers:{Authorization:`Bearer ${accessToken}`,"content-type":"application/json"},body:JSON.stringify({name:current.name,description:current.description}),cache:"no-store"}); } catch { /* Leave the original Drive change in place if rollback authorization is unavailable. */ }
    }
    fail(`/documents/${documentId}`, "Metadata tidak dapat diperbarui. Pastikan client dan invoice cocok.");
  }
  refreshDocuments(); saved(`/documents/${documentId}`, "metadata-updated");
}

export async function archiveDocumentAction(documentId: string) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const { error } = await ctx.supabase.rpc("set_agency_document_archive", { p_document_id: documentId, p_archived: true });
  if (error) fail(`/documents/${documentId}`, "Dokumen tidak dapat diarsipkan.");
  refreshDocuments(); saved("/documents", "document-archived");
}

export async function restoreDocumentAction(documentId: string) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const { error } = await ctx.supabase.rpc("set_agency_document_archive", { p_document_id: documentId, p_archived: false });
  if (error) fail("/documents?archived=1", "Dokumen tidak dapat dipulihkan.");
  refreshDocuments(); saved("/documents", "document-restored");
}

const invoiceSchema = z.object({
  invoice_id: z.union([z.literal(""), z.string().uuid()]),
  client_id: z.string().uuid(),
  client_package_id: z.union([z.literal(""), z.string().uuid()]),
  invoice_date: z.string().date(), due_date: z.string().date(), service_period: z.string().max(120),
  service_period_start: z.union([z.literal(""), z.string().date()]), service_period_end: z.union([z.literal(""), z.string().date()]),
  discount: z.coerce.number().finite().min(0).max(1e12), tax_rate: z.coerce.number().finite().min(0).max(1),
  notes: z.string().max(2000), items_json: z.string().min(2).max(30000),
});

export async function saveInvoiceDraftAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const parsed = invoiceSchema.safeParse(Object.fromEntries(["invoice_id","client_id","client_package_id","invoice_date","due_date","service_period","service_period_start","service_period_end","discount","tax_rate","notes","items_json"].map(key => [key, value(form,key)])));
  if (!parsed.success) fail("/documents/invoices/new", "Periksa data invoice dan item layanan.");
  let items: unknown;
  try { items = JSON.parse(parsed.data.items_json); } catch { fail("/documents/invoices/new", "Daftar item invoice tidak valid."); }
  const itemSchema = z.array(z.object({ description: z.string().trim().min(1).max(500), quantity: z.number().finite().positive().max(100000), unit_price: z.number().finite().min(0).max(1e12) })).min(1).max(50);
  const checkedItems = itemSchema.safeParse(items);
  if (!checkedItems.success) fail("/documents/invoices/new", "Invoice membutuhkan 1–50 item dengan jumlah dan harga yang valid.");
  if (parsed.data.due_date < parsed.data.invoice_date || (parsed.data.service_period_start && parsed.data.service_period_end && parsed.data.service_period_start > parsed.data.service_period_end)) fail("/documents/invoices/new", "Periksa tanggal jatuh tempo dan periode layanan.");
  const { data, error } = await ctx.supabase.rpc("save_invoice_draft", {
    p_invoice_id: parsed.data.invoice_id || null, p_client_id: parsed.data.client_id, p_client_package_id: parsed.data.client_package_id || null,
    p_invoice_date: parsed.data.invoice_date, p_due_date: parsed.data.due_date, p_service_period: parsed.data.service_period,
    p_service_period_start: parsed.data.service_period_start || null, p_service_period_end: parsed.data.service_period_end || null,
    p_discount: parsed.data.discount, p_tax_rate: parsed.data.tax_rate, p_notes: parsed.data.notes, p_items: checkedItems.data,
  });
  const invoice = Array.isArray(data) ? data[0] : data;
  if (error || !invoice?.out_invoice_id) fail(parsed.data.invoice_id ? `/documents/invoices/${parsed.data.invoice_id}/edit` : "/documents/invoices/new", "Draft invoice tidak dapat disimpan. Periksa client dan periode paket.");
  refreshDocuments(); redirect(`/documents/invoices/${invoice.out_invoice_id}?result=draft-saved`);
}

export async function deleteInvoiceDraftAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const id=value(form,"invoice_id");
  const { error }=await ctx.supabase.from("invoices").delete().eq("id",id).eq("created_by",ctx.user.id).eq("status","draft");
  if(error)fail(`/documents/invoices/${id}`,"Only your own draft invoice can be deleted.");
  refreshDocuments();saved("/documents/invoices","draft-deleted");
}

async function enqueueInvoicePdf(ctx: NonNullable<Awaited<ReturnType<typeof getActiveWorkspaceContext>>>, invoiceId: string) {
  const { data: existing } = await ctx.supabase.from("report_pdf_jobs").select("id,status").eq("invoice_id", invoiceId).maybeSingle();
  if (existing?.status === "failed") {
    const { error } = await ctx.supabase.rpc("requeue_report_pdf_job", { p_job_id: existing.id });
    return !error;
  }
  if (existing) return true;
  const { error } = await ctx.supabase.from("report_pdf_jobs").insert({ report_type: "invoice", invoice_id: invoiceId, created_by: ctx.user.id });
  return !error;
}

export async function finalizeInvoiceAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const id = value(form,"invoice_id");
  const { error } = await ctx.supabase.rpc("finalize_invoice", { p_invoice_id: id });
  if (error) fail(`/documents/invoices/${id}`, error.message.includes("agency_billing_profile_incomplete") ? "Lengkapi identitas dan rekening agency pada Billing Settings sebelum menerbitkan invoice." : "Invoice belum dapat diterbitkan. Periksa item dan konfigurasi billing.");
  const pdfQueued = await enqueueInvoicePdf(ctx,id);
  refreshDocuments(); saved(`/documents/invoices/${id}`, pdfQueued ? "invoice-issued" : "invoice-issued-pdf-queue-error");
}

export async function queueInvoicePdfAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const id = value(form,"invoice_id");
  const { data: invoice } = await ctx.supabase.from("invoices").select("id,status").eq("id",id).maybeSingle();
  if (!invoice || invoice.status === "draft" || invoice.status === "cancelled") fail(`/documents/invoices/${id}`, "PDF hanya dapat dibuat untuk invoice yang sudah diterbitkan.");
  if (!await enqueueInvoicePdf(ctx,id)) fail(`/documents/invoices/${id}`, "PDF queue belum tersedia. Periksa migration dan worker.");
  refreshDocuments(); saved(`/documents/invoices/${id}`, "pdf-queued");
}

export async function recordInvoicePaymentAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const id = value(form,"invoice_id"), amount = Number(value(form,"amount")), method = value(form,"method"), paidAt = value(form,"paid_at"), notes = value(form,"notes"), proof = value(form,"proof_document_id");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12 || !/^\d{4}-\d{2}-\d{2}$/.test(paidAt) || method.length < 1 || method.length > 80 || notes.length > 2000 || (proof && !z.string().uuid().safeParse(proof).success)) fail(`/documents/invoices/${id}`, "Periksa tanggal, nominal, metode, dan bukti pembayaran.");
  const { error } = await ctx.supabase.rpc("record_invoice_payment", { p_invoice_id: id, p_paid_at: paidAt, p_amount: amount, p_method: method, p_notes: notes, p_proof_document_id: proof || null });
  if (error) fail(`/documents/invoices/${id}`, error.message.includes("payment_exceeds_invoice_balance") ? "Nominal melebihi sisa tagihan." : "Pembayaran tidak dapat dicatat. Periksa saldo dan bukti yang dipilih.");
  refreshDocuments(); saved(`/documents/invoices/${id}`, "payment-recorded");
}

export async function cancelInvoiceAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const id = value(form,"invoice_id"), reason = value(form,"reason");
  if (reason.length > 500) fail(`/documents/invoices/${id}`, "Alasan pembatalan maksimal 500 karakter.");
  const { error } = await ctx.supabase.rpc("cancel_invoice", { p_invoice_id: id, p_reason: reason });
  if (error) fail(`/documents/invoices/${id}`, "Invoice tidak dapat dibatalkan. Pastikan belum ada pembayaran tercatat.");
  refreshDocuments(); saved(`/documents/invoices/${id}`, "invoice-cancelled");
}

export async function createInvoiceRevisionAction(form: FormData) {
  const ctx=await getActiveWorkspaceContext();if(!ctx)redirect("/login");
  const id=value(form,"invoice_id"),reason=value(form,"reason");
  if(reason.length<1||reason.length>500)fail(`/documents/invoices/${id}`,"Isi alasan revisi (maksimal 500 karakter).");
  const {data,error}=await ctx.supabase.rpc("create_invoice_revision",{p_invoice_id:id,p_reason:reason});
  if(error||typeof data!=="string")fail(`/documents/invoices/${id}`,"Revisi tidak dapat dibuat. Pastikan invoice belum memiliki pembayaran dan masih dapat direvisi.");
  refreshDocuments();redirect(`/documents/invoices/${data}?result=revision-created`);
}
