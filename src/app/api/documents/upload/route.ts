import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getGoogleDriveAccessToken } from "@/lib/google-drive";

const categoryFolders: Record<string, string> = {
  invoices: "01 Invoices & Payment Proofs",
  legal: "02 Contracts & Legal",
  sales: "03 Proposals & Sales",
  finance: "04 Finance & Planning",
  operations: "05 Company & Operations",
  clients: "06 Client Documents",
  reports: "07 Reports & Deliverables",
  archive: "08 Archive",
};
const signatures: Record<string, { extensions: string[]; match: (bytes: Uint8Array, file: File) => Promise<boolean> | boolean }> = {
  "application/pdf": { extensions: [".pdf"], match: b => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d },
  "application/msword": { extensions: [".doc"], match: b => starts(b, [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]) },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extensions: [".docx"], match: (b,f) => zipPackage(b,f,"word/document.xml") },
  "application/vnd.ms-excel": { extensions: [".xls"], match: b => starts(b, [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]) },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { extensions: [".xlsx"], match: (b,f) => zipPackage(b,f,"xl/workbook.xml") },
  "application/vnd.ms-powerpoint": { extensions: [".ppt"], match: b => starts(b, [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]) },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { extensions: [".pptx"], match: (b,f) => zipPackage(b,f,"ppt/presentation.xml") },
  "image/jpeg": { extensions: [".jpg", ".jpeg"], match: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { extensions: [".png"], match: b => starts(b, [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]) },
};
const maxFileBytes = 4 * 1024 * 1024;

function starts(bytes: Uint8Array, signature: number[]) { return signature.every((byte, index) => bytes[index] === byte); }
async function zipPackage(bytes: Uint8Array, file: File, requiredEntry: string) {
  if (!starts(bytes, [0x50,0x4b,0x03,0x04])) return false;
  const data = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let hasTypes = false, hasRequiredEntry = false;
  for (let offset = 0; offset + 46 <= data.length;) {
    if (view.getUint32(offset, true) !== 0x02014b50) { offset++; continue; }
    const nameLength = view.getUint16(offset + 28, true), extraLength = view.getUint16(offset + 30, true), commentLength = view.getUint16(offset + 32, true);
    const name = new TextDecoder().decode(data.subarray(offset + 46, offset + 46 + nameLength));
    if (name === "[Content_Types].xml") hasTypes = true;
    if (name === requiredEntry) hasRequiredEntry = true;
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return hasTypes && hasRequiredEntry;
}

async function findOrCreateDriveFolder(token: string, name: string, parentId: string) {
  const query = `name = '${name.replaceAll("'", "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;
  const params = new URLSearchParams({ q: query, fields: "files(id,name)", pageSize: "10", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
  const listed = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!listed.ok) throw new Error("Google Drive folder lookup failed.");
  const result = await listed.json() as { files?: Array<{ id: string }> };
  if (result.files?.[0]?.id) return result.files[0].id;
  const created = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }), cache: "no-store" });
  if (!created.ok) throw new Error("Google Drive folder could not be created.");
  const folder = await created.json() as { id?: string };
  if (!folder.id) throw new Error("Google Drive folder response did not include an ID.");
  return folder.id;
}

export async function POST(request: Request) {
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;
  const reply = (message: string, status = 400, documentId?: string) => wantsJson
    ? NextResponse.json(documentId ? { ok: true, documentId } : { ok: false, error: message }, { status })
    : NextResponse.redirect(new URL(`/documents?${documentId ? "upload=success" : `upload_error=${encodeURIComponent(message)}`}`, request.url), 303);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return reply("Upload origin could not be verified. Reload the page and try again.");
  if (!isSupabaseConfigured()) return reply("Workspace database is not configured.", 503);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return reply("Sign in to upload documents.", 401);
  const { data: member } = await supabase.from("agency_members").select("id,is_active").eq("id", user.id).maybeSingle();
  if (!member?.is_active) return reply("An active agency membership is required.", 403);

  let form: FormData;
  try { form = await request.formData(); } catch { return reply("The upload form could not be read."); }
  const file = form.get("file");
  const categoryId = String(form.get("category_id") ?? "");
  const requestedName = String(form.get("document_name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  let clientId = String(form.get("client_id") ?? "") || null;
  const invoiceId = String(form.get("invoice_id") ?? "") || null;
  if (!(file instanceof File) || file.size < 1 || file.size > maxFileBytes) return reply("Choose a supported file no larger than 4 MB.");
  const fileRule = signatures[file.type];
  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  if (!fileRule || !fileRule.extensions.includes(extension)) return reply("The selected file extension and MIME type are not supported.");
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!await fileRule.match(bytes, file)) return reply("The file contents do not match the selected file type.");
  const displayName = requestedName || file.name;
  if (displayName.length < 1 || displayName.length > 255 || description.length > 2000) return reply("Document name or description is too long.");
  if (!(categoryId in categoryFolders)) return reply("Choose a valid document category.");
  if (clientId) {
    const { data: client } = await supabase.from("clients").select("id,status").eq("id", clientId).maybeSingle();
    if (!client || client.status === "archived") return reply("Choose an available client.");
  }
  if (invoiceId) {
    const { data: invoice } = await supabase.from("invoices").select("id,client_id").eq("id", invoiceId).maybeSingle();
    if (!invoice || (clientId && invoice.client_id !== clientId)) return reply("The selected invoice does not belong to this client.");
    clientId = invoice.client_id;
  }
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) return reply("Set GOOGLE_DRIVE_ROOT_FOLDER_ID to the BABE AGENCY Drive folder.", 503);
  let admin;
  try { admin = createAdminClient(); } catch { return reply("Server-side document metadata credentials are not configured.", 503); }

  try {
    const token = await getGoogleDriveAccessToken();
    const { data: category, error: categoryError } = await admin.from("document_categories").select("id,label,drive_folder_id").eq("id", categoryId).maybeSingle();
    if (categoryError || !category) return reply("The document category is unavailable. Apply the latest Documents migration.", 503);
    let categoryFolderId = category.drive_folder_id;
    if (!categoryFolderId) {
      categoryFolderId = await findOrCreateDriveFolder(token, categoryFolders[categoryId], rootFolderId);
      await admin.from("document_categories").update({ drive_folder_id: categoryFolderId }).eq("id", categoryId);
    }
    let destinationFolderId = categoryFolderId;
    if (categoryId === "clients" && clientId) {
      const { data: client } = await supabase.from("clients").select("brand_name").eq("id", clientId).maybeSingle();
      if (!client) return reply("The selected client is unavailable.", 404);
      destinationFolderId = await findOrCreateDriveFolder(token, `${client.brand_name} (${clientId.slice(0, 8)})`, categoryFolderId);
    }
    const metadata = { name: displayName, description, parents: [destinationFolderId] };
    const body = new FormData();
    body.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    body.append("file", file, file.name);
    const upload = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,parents", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body, cache: "no-store" });
    if (!upload.ok) return reply("Google Drive upload failed. No document record was created.", 502);
    const drive = await upload.json() as { id: string; name: string; mimeType: string; size: string; webViewLink?: string; parents?: string[] };
    const { data: document, error: metadataError } = await admin.from("agency_documents").insert({ name: drive.name, category_id: categoryId, client_id: clientId, invoice_id: invoiceId, description, drive_file_id: drive.id, drive_folder_id: destinationFolderId, web_view_link: drive.webViewLink ?? null, mime_type: drive.mimeType, size_bytes: Number(drive.size || file.size), uploaded_by: user.id }).select("id").single();
    if (metadataError || !document) {
      await admin.from("agency_document_upload_orphans").insert({ drive_file_id: drive.id, drive_folder_id: destinationFolderId, file_name: drive.name, category_id: categoryId, uploaded_by: user.id, metadata_error: String(metadataError?.message ?? "metadata insert returned no row").slice(0, 500) });
      const deleted = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(drive.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (deleted.ok || deleted.status === 404) await admin.from("agency_document_upload_orphans").update({ drive_deleted_at: new Date().toISOString() }).eq("drive_file_id", drive.id);
      return reply("Drive received the file but its metadata could not be saved. The file was queued for cleanup and recorded.", 502);
    }
    return reply("", 200, document.id);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "google_drive_reauth_required") return reply("Google Drive needs to be authorized again. Re-run the local Google Drive authorization setup.", 503);
    if (code === "google_drive_configuration_required") return reply("Complete the Google Drive authorization setup before uploading documents.", 503);
    return reply("Google Drive upload failed. No document record was created.", 502);
  }
}
