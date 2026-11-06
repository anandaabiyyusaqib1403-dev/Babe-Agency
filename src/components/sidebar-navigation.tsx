"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

const navigationGroups = [
  { id: "workspace", label: "Workspace", items: [{ label: "Clients", href: "/clients" }, { label: "Content Planner", href: "/content" }] },
  { id: "management", label: "Management", items: [{ label: "To-do List", href: "/tasks" }, { label: "Approval", href: "/approval" }] },
  { id: "insights", label: "Insights", items: [{ label: "Performance", href: "/performance" }, { label: "Reports", href: "/reports" }] },
  { id: "documents", label: "Documents", items: [{ label: "Document Center", href: "/documents" }, { label: "Invoice Generator", href: "/documents/invoices" }] },
];

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="5" height="5" rx="1" /><rect x="12" y="3" width="5" height="5" rx="1" /><rect x="3" y="12" width="5" height="5" rx="1" /><rect x="12" y="12" width="5" height="5" rx="1" /></>,
    workspace: <><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M3 8h14M8 8v8" /></>,
    management: <><path d="M5 4h10v13H5zM8 8h4M8 11h4M8 14h2" /><path d="m3 6 2-2m10 13 2-2" /></>,
    insights: <><path d="M3 16.5h14M5 14V9h2v5m3 0V5h2v9m3 0V7h2v7" /></>,
    documents: <><path d="M5 2.5h7l4 4V17a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" /><path d="M12 2.5v4h4M7 11h6M7 14h6" /></>,
    settings: <><circle cx="10" cy="10" r="3" /><path d="m10 2 .7 1.8 1.8.7 1.8-.7L16 5.1l-.7 1.8.7 1.8 1.8.7v2l-1.8.7-.7 1.8.7 1.8-1.4 1.4-1.8-.7-1.8.7-.7 1.8h-2l-.7-1.8-1.8-.7-1.8.7-1.4-1.4.7-1.8-.7-1.8-1.8-.7v-2l1.8-.7.7-1.8-.7-1.8 1.4-1.4 1.8.7 1.8-.7L8 2h2Z" /></>,
  };
  return <svg className="nav-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function SidebarNavigation() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(() => navigationGroups.find(group => group.items.some(item => item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`))))?.id ?? null);
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>(".brand-lockup")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  function closeMobileNavigation() {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  }

  function toggleGroup(id: string) {
    setOpenGroup(current => current === id ? null : id);
  }

  return <>
    <button
      ref={menuButtonRef}
      className="mobile-menu"
      type="button"
      aria-label="Open navigation menu"
      aria-expanded={mobileOpen}
      aria-controls="primary-navigation"
      onClick={() => setMobileOpen(true)}
    >Menu</button>

    {mobileOpen && <div className="mobile-scrim" aria-hidden="true" onClick={closeMobileNavigation} />}

    <aside
      ref={drawerRef}
      id="primary-navigation"
      className={`sidebar${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " sidebar-mobile-open" : ""}`}
      aria-label="Primary sidebar"
      aria-modal={mobileOpen || undefined}
      role={mobileOpen ? "dialog" : undefined}
    >
      <div className="brand-row">
        <Link href="/" className="brand-lockup" aria-label="BABE AGENCY home" onClick={closeMobileNavigation}>
          <span className="brand-mark" aria-hidden="true">b.</span>
          {!collapsed && <span className="brand-copy"><strong>BABE AGENCY</strong><small>WORKSPACE</small></span>}
        </Link>
        <button className="collapse-button" type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(value => !value)}>
          <span aria-hidden="true">{collapsed ? ">" : "<"}</span>
        </button>
        <button className="mobile-drawer-close" type="button" aria-label="Close navigation menu" onClick={closeMobileNavigation}>Close</button>
      </div>

      <nav className="side-nav" aria-label="Main navigation">
        <div className="nav-section-label">OVERVIEW</div>
        <Link
          prefetch={false}
          href="/dashboard"
          aria-label="Dashboard"
          onClick={closeMobileNavigation}
          title={collapsed ? "Dashboard" : undefined}
          aria-current={pathname === "/dashboard" ? "page" : undefined}
          className={`nav-link${pathname === "/dashboard" ? " nav-active" : ""}`}
        >
          <span className="nav-glyph"><NavIcon name="dashboard" /></span>
          {!collapsed && <span>Dashboard</span>}
        </Link>

        {navigationGroups.map(group => {
          const expanded = openGroup === group.id;
          const submenuId = `navigation-${group.id}`;
          return <section className="nav-group" key={group.id}>
            <button
              type="button"
              className="nav-group-trigger"
              aria-label={group.label}
              aria-expanded={expanded}
              aria-controls={submenuId}
              title={collapsed ? group.label : undefined}
              onClick={() => toggleGroup(group.id)}
            >
              <span className="nav-glyph"><NavIcon name={group.id} /></span>
              {!collapsed && <><span>{group.label}</span><span className={`nav-chevron${expanded ? " nav-chevron-open" : ""}`} aria-hidden="true" /></>}
            </button>
            <div className="nav-subitems" id={submenuId} hidden={!expanded}>
              {group.items.map(item => { const active = Boolean(item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`))); return item.href ? <Link key={item.label} href={item.href} prefetch={false} className={`nav-subitem${active ? " nav-subitem-active" : ""}`} aria-current={active ? "page" : undefined} onClick={closeMobileNavigation}>{item.label}</Link> : <span key={item.label} className="nav-unavailable" aria-disabled="true">{item.label}</span>; })}
            </div>
          </section>;
        })}

        <div className="nav-section-label nav-settings-label">PREFERENCES</div>
        <Link href="/settings" prefetch={false} aria-current={pathname.startsWith("/settings") ? "page" : undefined} className={`nav-link nav-settings${pathname.startsWith("/settings") ? " nav-active" : ""}`} title={collapsed ? "Settings" : undefined} onClick={closeMobileNavigation}>
          <span className="nav-glyph"><NavIcon name="settings" /></span>
          {!collapsed && <span>Settings</span>}
        </Link>
      </nav>

      {!collapsed && <div className="sidebar-footer">Internal agency workspace</div>}
    </aside>
  </>;
}
