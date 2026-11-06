import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { SidebarNavigation } from "@/components/sidebar-navigation";

export function AppShell() {
  return <div className="app-frame">
    <SidebarNavigation />
    <main className="main-area">
      <header className="topbar">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <span>Workspace</span><span className="crumb-divider" aria-hidden="true">/</span><span aria-current="page">Overview</span>
        </nav>
        <Link className="profile-link" href="/login" prefetch={false}>
          <span className="avatar" aria-hidden="true">BA</span>
          <span>Sign in</span>
        </Link>
      </header>

      <div className="page-content">
        <div className="page-heading">
          <div>
            <p className="page-kicker">BABE AGENCY</p>
            <h1>Dashboard</h1>
            <p className="page-description">An overview of your agency workspace.</p>
          </div>
        </div>

        <EmptyState title="Your workspace is ready">
          Sign in with an active agency account to continue. Workspace data will appear here as the agency modules are developed.
        </EmptyState>
      </div>
    </main>
  </div>;
}
