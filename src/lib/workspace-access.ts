import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export async function getActiveWorkspaceContext() {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member, error } = await supabase
    .from("agency_members")
    .select("id, full_name, email, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !member?.is_active) redirect("/workspace");

  const { data: workspaceAccess, error: accessError } = await supabase.rpc("workspace_my_access");
  if (accessError || !workspaceAccess?.is_active) redirect("/workspace");

  return { supabase, member, user, access: workspaceAccess };
}
