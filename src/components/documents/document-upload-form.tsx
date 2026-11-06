"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ClientOption = { id: string; brand_name: string };
type InvoiceOption = { id: string; invoice_number: string; client_id: string };
type CategoryOption = { id: string; label: string };

export function DocumentUploadForm({ clients, invoices, categories, selectedCategory = "clients", selectedInvoice = "" }: { clients: ClientOption[]; invoices: InvoiceOption[]; categories: CategoryOption[]; selectedCategory?: string; selectedInvoice?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const maxBytes = 4 * 1024 * 1024;

  function upload() {
    const form = formRef.current;
    if (!form || !file || busy) return;
    if (file.size > maxBytes) { setError("Ukuran file maksimal 4 MB."); return; }
    setBusy(true); setError(""); setSuccess(false); setProgress(0);
    const request = new XMLHttpRequest();
    request.open("POST", "/api/documents/upload");
    request.setRequestHeader("Accept", "application/json");
    request.upload.addEventListener("progress", event => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); });
    request.addEventListener("load", () => {
      let result: { ok?: boolean; error?: string } = {};
      try { result = JSON.parse(request.responseText) as typeof result; } catch { result.error = "Server mengembalikan respons yang tidak dikenali."; }
      if (request.status >= 200 && request.status < 300 && result.ok) {
        setProgress(100); setSuccess(true); setFile(null); form.reset(); router.refresh();
      } else setError(result.error ?? "Upload gagal. Coba lagi.");
      setBusy(false);
    });
    request.addEventListener("error", () => { setBusy(false); setError("Koneksi terputus sebelum upload selesai."); });
    request.addEventListener("abort", () => { setBusy(false); setError("Upload dibatalkan."); });
    request.send(new FormData(form));
  }
  function chooseDroppedFile(candidate:File){
    if(candidate.size>maxBytes){setError("Ukuran file maksimal 4 MB.");return;}
    if(!/\.(pdf|docx?|xlsx?|pptx?|jpe?g|png)$/i.test(candidate.name)){setError("Format file tidak didukung.");return;}
    setFile(candidate);setProgress(null);setError("");setSuccess(false);
  }

  return <form ref={formRef} className="workspace-form document-upload-form" onSubmit={event => { event.preventDefault(); upload(); }}>
    <label>Document name <input name="document_name" maxLength={255} placeholder={file?.name ?? "Nama dokumen"} /></label>
    <label>Category <select name="category_id" defaultValue={selectedCategory}>{categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
    <label>Related client <select name="client_id" defaultValue=""><option value="">Agency document</option>{clients.map(client => <option key={client.id} value={client.id}>{client.brand_name}</option>)}</select></label>
    <label>Related invoice <select name="invoice_id" defaultValue={selectedInvoice}><option value="">No invoice</option>{invoices.map(invoice => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number}</option>)}</select></label>
    <label className="field-wide">Description <textarea name="description" maxLength={2000} rows={2} /></label>
    <label className="field-wide document-file-picker" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();const candidate=event.dataTransfer.files[0];if(candidate)chooseDroppedFile(candidate);}}>File (PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, JPG/JPEG, PNG) — browse or drop a file here
      <input name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png" required disabled={busy} onChange={event => { setFile(event.currentTarget.files?.[0] ?? null); setProgress(null); setError(""); setSuccess(false); }} />
      <small>{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "Maksimum 4 MB per file."}</small>
    </label>
    {progress !== null && <div className="document-upload-progress field-wide"><label htmlFor="document-upload-progress">{busy ? `Uploading ${progress}%` : success ? "Upload complete" : "Upload progress"}</label><progress id="document-upload-progress" max="100" value={progress} /></div>}
    {error && <p className="workspace-inline-error field-wide" role="alert">{error}</p>}{success && <p className="workspace-inline-success field-wide" role="status">Dokumen tersimpan di Google Drive.</p>}
    <div className="form-actions"><button className="ui-button ui-button-primary" type="submit" disabled={!file || busy}>{busy ? "Uploading…" : "Upload document"}</button></div>
  </form>;
}
