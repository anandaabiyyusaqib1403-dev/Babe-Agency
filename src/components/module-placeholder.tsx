import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SetupNotice } from "@/components/setup-notice";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";

export async function ModulePlaceholder({
  title,
  section,
  description,
  finance = false,
}: {
  title: string;
  section: string;
  description: string;
  finance?: boolean;
}) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) return <SetupNotice />;

  return <WorkspaceShell title={title} section={section} description={description} memberName={ctx.member.full_name} memberEmail={ctx.member.email}>
    <section className="module-placeholder" aria-labelledby="module-placeholder-title">
      <div className="module-placeholder-topline"><span className="module-placeholder-mark" aria-hidden="true">{finance ? "F" : "B"}</span><span>{finance ? "ACCESS CONTROL REQUIRED" : "MODULE FOUNDATION"}</span></div>
      <h2 id="module-placeholder-title">{finance ? "Finance access is not enabled" : "This workspace area is not available yet"}</h2>
      <p>{finance
        ? "The finance permission model has not been connected. This route does not load or display financial records."
        : description}</p>
      <p className="module-placeholder-note">No sample records or simulated activity are shown here.</p>
      <Link className="module-placeholder-link" href={finance ? "/dashboard" : "/content"}>{finance ? "Return to Studio Overview" : "Open Content Planner"}</Link>
    </section>
  </WorkspaceShell>;
}
