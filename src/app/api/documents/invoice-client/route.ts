import { NextResponse } from "next/server";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";

export async function GET(request: Request) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "Sign in with an active agency account." }, { status: 401 });
  const clientId = new URL(request.url).searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "Choose a client." }, { status: 400 });
  const [{ data: client, error: clientError }, { data: assignments, error: packageError }] = await Promise.all([
    ctx.supabase.from("clients").select("id,client_name,brand_name,contact_person,email,phone,address,status").eq("id", clientId).neq("status", "archived").maybeSingle(),
    ctx.supabase.from("client_packages").select("id,package_name_snapshot,package_description_snapshot,package_price_snapshot,start_date,end_date,status").eq("client_id", clientId).eq("status", "active").order("start_date", { ascending: false }).limit(10),
  ]);
  if (clientError || packageError) return NextResponse.json({ error: "Client billing information could not be loaded." }, { status: 502 });
  if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });
  const assignmentIds = (assignments ?? []).map(row => row.id);
  const { data: quotas, error: quotaError } = assignmentIds.length ? await ctx.supabase.from("client_package_quota_usage").select("client_package_id,content_type,quota,used").in("client_package_id", assignmentIds).limit(300) : { data: [], error: null };
  if (quotaError) return NextResponse.json({ error: "Package quota could not be loaded." }, { status: 502 });
  return NextResponse.json({ client, assignments: (assignments ?? []).map(assignment => ({ ...assignment, quotas: (quotas ?? []).filter(quota => quota.client_package_id === assignment.id) })) }, { headers: { "cache-control": "private, no-store" } });
}
