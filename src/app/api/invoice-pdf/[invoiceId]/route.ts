import { NextResponse } from "next/server";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";
import { getGoogleDriveAccessToken } from "@/lib/google-drive";

export async function GET(request:Request,{params}:{params:Promise<{invoiceId:string}>}){
  const ctx=await getActiveWorkspaceContext();if(!ctx)return NextResponse.json({error:"unauthorized"},{status:401});
  const {invoiceId}=await params;
  const [{data:invoice},{data:job}]=await Promise.all([
    ctx.supabase.from("invoices").select("id,invoice_number,status,pdf_drive_file_id").eq("id",invoiceId).maybeSingle(),
    ctx.supabase.from("report_pdf_jobs").select("status,file_path,last_error").eq("invoice_id",invoiceId).maybeSingle(),
  ]);
  if(!invoice||["draft","cancelled"].includes(invoice.status))return NextResponse.json({error:"invoice_pdf_not_found"},{status:404});
  if(!job||job.status!=="completed"||!job.file_path)return NextResponse.json({error:"invoice_pdf_not_ready",status:job?.status??"not_queued",last_error:job?.last_error??null},{status:409});
  const download=new URL(request.url).searchParams.has("download");
  const disposition=`${download?"attachment":"inline"}; filename="${invoice.invoice_number.replace(/[^A-Za-z0-9._-]/g,"_")}.pdf"`;
  if(invoice.pdf_drive_file_id&&process.env.GOOGLE_DRIVE_CLIENT_ID&&process.env.GOOGLE_DRIVE_CLIENT_SECRET&&(process.env.GOOGLE_DRIVE_REFRESH_TOKEN_NEXT||process.env.GOOGLE_DRIVE_REFRESH_TOKEN)){
    try{
      const accessToken=await getGoogleDriveAccessToken();const file=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(invoice.pdf_drive_file_id)}?alt=media`,{headers:{Authorization:`Bearer ${accessToken}`},cache:"no-store",signal:AbortSignal.timeout(30_000)});if(file.ok)return new NextResponse(file.body,{headers:{"content-type":"application/pdf","content-disposition":disposition,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
    }catch{/* Use the private worker storage copy below if Drive is temporarily unavailable. */}
  }
  const {data,error}=await ctx.supabase.storage.from("agency-reports").createSignedUrl(job.file_path,60);
  if(error||!data?.signedUrl)return NextResponse.json({error:"invoice_pdf_unavailable"},{status:502});
  const storedFile=await fetch(data.signedUrl,{cache:"no-store"});
  if(!storedFile.ok)return NextResponse.json({error:"invoice_pdf_unavailable"},{status:502});
  return new NextResponse(storedFile.body,{headers:{"content-type":"application/pdf","content-disposition":disposition,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
}
