export const instant = false;
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { SetupNotice } from "@/components/setup-notice";

export default async function WorkspacePage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member, error } = await supabase.from("agency_members").select("full_name,is_active").eq("id", user.id).maybeSingle();
  if (error || !member?.is_active) return <main className="access-page"><div className="access-mark">b.</div><div className="login-eyebrow">WORKSPACE ACCESS</div><h1>{error ? "Workspace check unavailable" : "Access not enabled"}<span>.</span></h1><p>{error ? "We could not verify your membership against the current database schema. Ask the project owner to reconcile pending Supabase migrations." : "Your account is signed in, but it has no active BABE AGENCY membership. No workspace administrator is provisioned yet; the project owner must set up the first active member."}</p><form action="/auth/signout" method="post"><button className="button button-secondary">Sign out</button></form></main>;
  redirect("/dashboard");
}
