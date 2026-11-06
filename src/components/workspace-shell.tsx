import Link from "next/link";
import type { ReactNode } from "react";
import { SidebarNavigation } from "@/components/sidebar-navigation";

export function WorkspaceShell({
  title,
  section,
  children,
  memberName,
  memberEmail,
}: {
  title: string;
  section: string;
  children: ReactNode;
  memberName: string;
  memberEmail?: string | null;
}) {
  const initials = memberName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  return <div className="app-frame">
    <SidebarNavigation />
    <main className="main-area">
      <header className="topbar">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/dashboard">BABE AGENCY</Link><span className="crumb-divider" aria-hidden="true">/</span><span aria-current="page">{section}</span>
        </nav>
        <div className="topbar-tools">
          <form action="/tasks" className="topbar-search" role="search">
            <svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
            <input type="search" name="q" aria-label="Search tasks" placeholder="Search tasks" />
          </form>
          <Link className="topbar-icon-link" href="/tasks?deadline=overdue" aria-label="Open overdue tasks" title="Overdue tasks">
            <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M15.5 7.5a5.5 5.5 0 0 0-11 0c0 6-2 6.5-2 7.5h15c0-1-2-1.5-2-7.5ZM8 17h4" /></svg>
          </Link>
          <Link className="profile-link" href="/workspace" prefetch={false} aria-label={`Workspace profile: ${memberName}${memberEmail ? `, ${memberEmail}` : ""}`}>
            <span className="avatar" aria-hidden="true">{initials || "BA"}</span>
            <span className="profile-copy"><strong>{memberName}</strong><small>{memberEmail || "Agency member"}</small></span>
          </Link>
        </div>
      </header>
      <div className="page-content">
        <div className="page-heading"><div><h1>{title}</h1></div></div>
        {children}
      </div>
    </main>
  </div>;
}
