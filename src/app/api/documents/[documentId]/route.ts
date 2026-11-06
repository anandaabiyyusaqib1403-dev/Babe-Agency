import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleDriveAccessToken } from "@/lib/google-drive";

export async function GET(request:Request,{params}:{params:Promise<{documentId:string}>}){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return new NextResponse("Unauthorized",{status:401});
 const {data:member}=await supabase.from("agency_members").select("is_active").eq("id",user.id).maybeSingle();if(!member?.is_active)return new NextResponse("Forbidden",{status:403});
 const {documentId}=await params;const {data:doc,error}=await supabase.from("agency_documents").select("drive_file_id,name,mime_type").eq("id",documentId).maybeSingle();if(error||!doc?.drive_file_id)return new NextResponse("Document not found",{status:404});
 try{const accessToken=await getGoogleDriveAccessToken();const file=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.drive_file_id)}?alt=media`,{headers:{Authorization:`Bearer ${accessToken}`},cache:"no-store",signal:AbortSignal.timeout(30_000)});if(!file.ok)return new NextResponse("Drive file is unavailable",{status:502});return new NextResponse(file.body,{headers:{"content-type":doc.mime_type,"content-disposition":`${new URL(request.url).searchParams.has("download")?"attachment":"inline"}; filename*=UTF-8''${encodeURIComponent(doc.name)}`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});}catch(error){const message=error instanceof Error&&error.message==="google_drive_reauth_required"?"Google Drive authorization has expired. Re-run the local authorization setup.":"Drive connection failed";return new NextResponse(message,{status:502});}
}
