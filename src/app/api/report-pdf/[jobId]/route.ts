import { NextResponse, type NextRequest } from "next/server";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";
import { isSupabaseConfigured } from "@/lib/env";
import { getGoogleDriveAccessToken } from "@/lib/google-drive";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "workspace_not_configured" }, { status: 503 });
  const { jobId } = await params;
  const { data: job, error } = await ctx.supabase.from("report_pdf_jobs").select("status,file_path").eq("id", jobId).maybeSingle();
  if (error || !job) return NextResponse.json({ error: "report_pdf_not_found" }, { status: 404 });
  if (job.status !== "completed" || !job.file_path) return NextResponse.json({ error: "report_pdf_not_ready", status: job.status }, { status: 409 });
  const { data: driveDocument } = await ctx.supabase.from("agency_documents").select("drive_file_id,name").eq("report_pdf_job_id", jobId).maybeSingle();
  if (driveDocument?.drive_file_id) {
    try {
      const accessToken = await getGoogleDriveAccessToken();
      const file = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveDocument.drive_file_id)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(30_000) });
      if (file.ok) return new NextResponse(file.body, { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(driveDocument.name)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
    } catch { /* Use the private worker storage copy while Drive is unavailable. */ }
  }
  const { data, error: storageError } = await ctx.supabase.storage.from("agency-reports").createSignedUrl(job.file_path, 60);
  if (storageError || !data?.signedUrl) return NextResponse.json({ error: "report_pdf_unavailable" }, { status: 502 });
  return NextResponse.redirect(data.signedUrl);
}
