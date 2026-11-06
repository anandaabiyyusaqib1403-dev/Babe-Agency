import Link from "next/link";
import type { ReactNode } from "react";
import { SidebarNavigation } from "@/components/sidebar-navigation";

export function WorkspaceShell({
  title,
  section,
  description,
  children,
  memberName,
  memberEmail,
  permissions,
}: {
  title: string;
  section: string;
  description?: string;
  children: ReactNode;
  memberName: string;
  memberEmail?: string | null;
  permissions?: readonly string[];
}) {
  const initials = memberName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  return <div className="app-frame">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <SidebarNavigation permissions={permissions} />
    <main className="main-area" id="main-content" tabIndex={-1}>
      <header className="topbar">
        <div className="topbar-context">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/dashboard">BABE CONTENT STUDIO</Link>
            <span className="crumb-divider" aria-hidden="true">/</span>
            <span aria-current="page">{section}</span>
          </nav>
          <p className="topbar-workspace-label">BABE AGENCY · INTERNAL WORKSPACE</p>
        </div>
        <div className="topbar-tools">
          <form action="/tasks" className="topbar-search" role="search">
            <svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
            <input type="search" name="q" aria-label="Search tasks" placeholder="Search tasks" />
            <kbd aria-hidden="true">/</kbd>
          </form>
          <Link className="topbar-icon-link" href="/tasks?deadline=overdue" aria-label="Open task reminders" title="Task reminders">
            <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M15.5 7.5a5.5 5.5 0 0 0-11 0c0 6-2 6.5-2 7.5h15c0-1-2-1.5-2-7.5ZM8 17h4" /></svg>
          </Link>
          <details className="profile-menu">
            <summary className="profile-link" aria-label={`Open profile menu for ${memberName}`}>
              <span className="avatar" aria-hidden="true">{initials || "BA"}</span>
              <span className="profile-copy"><strong>{memberName}</strong><small>{memberEmail || "Agency member"}</small></span>
              <svg className="profile-chevron" aria-hidden="true" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg>
            </summary>
            <div className="profile-menu-panel">
              <div className="profile-menu-identity"><strong>{memberName}</strong><span>{memberEmail || "Agency member"}</span></div>
              <Link href="/settings?section=profile">My profile</Link>
              <Link href="/settings?section=security">Account security</Link>
              <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>
            </div>
          </details>
        </div>
      </header>
      <div className="page-content">
        <div className="page-heading">
          <div>
            <p className="page-kicker">{section.split("/").at(-1)?.trim() || "BABE CONTENT STUDIO"}</p>
            <h1>{title}</h1>
            {description && <p className="page-description">{description}</p>}
          </div>
        </div>
        {children}
      </div>
    </main>
  </div>;
}
