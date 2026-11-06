export const instant = false;
import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace-shell";
import { ClientForm, Feedback } from "@/components/workspace/client-form";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";
import { SetupNotice } from "@/components/setup-notice";
import { updateWorkspaceClient } from "@/app/actions/workspace-actions";

export default async function EditClientPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) return <SetupNotice />;
  const [{ clientId }, query] = await Promise.all([params, searchParams]);
  const { data: client, error } = await ctx.supabase.from("clients").select("id,client_name,brand_name,contact_person,email,phone,address,industry,notes,status").eq("id", clientId).is("deleted_at", null).maybeSingle();
  if (error || !client) return <WorkspaceShell title="Edit client" section="Workspace / Clients / Edit" memberName={ctx.member.full_name} memberEmail={ctx.member.email}><p role="alert">Client tidak ditemukan atau tidak dapat dibuka.</p></WorkspaceShell>;
  return <WorkspaceShell title="Edit client" section={`Workspace / Clients / ${client.brand_name} / Edit`} memberName={ctx.member.full_name} memberEmail={ctx.member.email}><div className="workspace-page"><p><Link href={`/clients/${clientId}`}>← Kembali ke detail client</Link></p><Feedback error={query.error} saved={query.saved} /><section className="workspace-panel"><h2>Client information</h2><ClientForm client={client} action={updateWorkspaceClient.bind(null, clientId)} submitLabel="Save changes" /></section></div></WorkspaceShell>;
}
