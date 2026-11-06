"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useAppShellState } from "@/components/app-shell-state";

type NavigationItem = { label: string; href: string; permission?: string; children?: NavigationItem[] };
type NavigationGroup = { id: string; label: string; items: NavigationItem[] };

const navigationGroups: NavigationGroup[] = [
  { id: "studio", label: "Studio", items: [
    { label: "Studio Overview", href: "/dashboard" },
    { label: "Client Portfolio", href: "/clients" },
  ] },
  { id: "creative", label: "Creative Workflow", items: [
    { label: "Content Studio", href: "/content", children: [
      { label: "Idea Bank", href: "/content/ideas" },
      { label: "Content Planner", href: "/content" },
      { label: "Production Board", href: "/content/production" },
      { label: "Content Library", href: "/content/library" },
    ] },
    { label: "Review & Approval", href: "/approval" },
    { label: "Publishing Schedule", href: "/publishing" },
  ] },
  { id: "growth", label: "Growth & Insights", items: [
    { label: "Performance Insights", href: "/performance" },
    { label: "Reports & Recap", href: "/reports" },
  ] },
  { id: "finance", label: "Studio Finance", items: [
    { label: "Finance Overview", href: "/finance", permission: "finance.read" },
    { label: "Cash Flow", href: "/finance/cash-flow", permission: "finance.read" },
    { label: "Transactions", href: "/finance/transactions", permission: "finance.read" },
    { label: "Financial Reports", href: "/finance/reports", permission: "finance.report.read" },
    { label: "Accounts & Categories", href: "/finance/accounts", permission: "finance.account.read" },
  ] },
  { id: "resources", label: "Studio Resources", items: [
    { label: "Asset Library", href: "/assets" },
    { label: "Document Archive", href: "/documents" },
  ] },
  { id: "settings", label: "Settings", items: [
    { label: "Studio Settings", href: "/settings" },
  ] },
];

const iconPaths: Record<string, ReactNode> = {
  studio: <><path d="M3 9.5 10 4l7 5.5V17H3z" /><path d="M7.5 17v-5h5v5M3 9.5h14" /></>,
  creative: <><path d="M4 4h12v12H4z" /><path d="m7 12 2-2 1.7 1.5L14 8" /><path d="M7 7h.01M7 14h6" /></>,
  growth: <><path d="M3 16.5h14" /><path d="M5 14V9h2v5m3 0V5h2v9m3 0V7h2v7" /></>,
  finance: <><rect x="3" y="5" width="14" height="11" rx="2" /><path d="M3 9h14M7 13h3" /><path d="M6 3v2m8-2v2" /></>,
  resources: <><path d="M3 6h5l1.5 2H17v8H3z" /><path d="M3 8h14" /></>,
  settings: <><circle cx="10" cy="10" r="3" /><path d="m10 2 .7 1.8 1.8.7 1.8-.7 1.4 1.4-.7 1.8.7 1.8 1.8.7v2l-1.8.7-.7 1.8.7 1.8-1.4 1.4-1.8-.7-1.8.7L10 18l-.7-1.8-1.8-.7-1.8.7-1.4-1.4.7-1.8-.7-1.8-1.8-.7v-2l1.8-.7.7-1.8-.7-1.8 1.4-1.4 1.8.7 1.8-.7z" /></>,
};

function NavIcon({ name }: { name: string }) {
  return <svg className="nav-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>;
}

function routeIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNavigation({ permissions = [] }: { permissions?: readonly string[] }) {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useAppShellState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentGroup = navigationGroups.find(group => group.items.some(item => routeIsActive(pathname, item.href)));
  const [openGroup, setOpenGroup] = useState<string | null>(currentGroup?.id ?? "studio");
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const matchedGroup = navigationGroups.find(group => group.items.some(item => routeIsActive(pathname, item.href)));
    if (matchedGroup) setOpenGroup(matchedGroup.id);
    setMobileOpen(false);
  }, [pathname]);

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
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
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

  return <>
    <button ref={menuButtonRef} className="mobile-menu" type="button" aria-label="Open navigation menu" aria-expanded={mobileOpen} aria-controls="primary-navigation" onClick={() => setMobileOpen(true)}>
      <span className="mobile-menu-lines" aria-hidden="true"><i /><i /><i /></span>
      <span>Menu</span>
    </button>
    {mobileOpen && <button type="button" className="mobile-scrim" aria-label="Close navigation menu" onClick={closeMobileNavigation} />}

    <aside ref={drawerRef} id="primary-navigation" className={`sidebar${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " sidebar-mobile-open" : ""}`} aria-label="Primary navigation" aria-modal={mobileOpen || undefined} role={mobileOpen ? "dialog" : undefined}>
      <div className="brand-row">
        <Link href="/dashboard" className="brand-lockup" aria-label="BABE Content Studio home" onClick={closeMobileNavigation}>
          <span className="brand-mark" aria-hidden="true">b.</span>
          {!collapsed && <span className="brand-copy"><strong>BABE</strong><small>CONTENT STUDIO</small></span>}
        </Link>
        <button className="collapse-button" type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={collapsed} onClick={() => setCollapsed(!collapsed)}>
          <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
        </button>
        <button className="mobile-drawer-close" type="button" aria-label="Close navigation menu" onClick={closeMobileNavigation}>Close</button>
      </div>

      <nav className="side-nav" aria-label="Main navigation">
        {navigationGroups.map(group => {
          const expanded = openGroup === group.id;
          const submenuId = `navigation-${group.id}`;
          return <section className="nav-group" key={group.id}>
            <button type="button" className={`nav-group-trigger${currentGroup?.id === group.id ? " nav-group-current" : ""}`} aria-label={group.label} aria-expanded={expanded} aria-controls={submenuId} title={collapsed ? group.label : undefined} onClick={() => setOpenGroup(expanded ? null : group.id)}>
              <span className="nav-glyph"><NavIcon name={group.id} /></span>
              {!collapsed && <><span>{group.label}</span><span className={`nav-chevron${expanded ? " nav-chevron-open" : ""}`} aria-hidden="true" /></>}
            </button>
            <div className="nav-subitems" id={submenuId} hidden={!expanded}>
              {group.items.map(item => {
                if (item.children) {
                  const parentActive = routeIsActive(pathname, item.href);
                  return <div className="nav-parent-item" key={item.label}>
                    <Link href={item.href} prefetch={false} className={`nav-subitem nav-parent-link${parentActive ? " nav-parent-active" : ""}`} aria-current={pathname === item.href ? "page" : undefined} onClick={closeMobileNavigation}>{item.label}</Link>
                    <div className="nav-nested-items">{item.children.map(child => {
                      const active = routeIsActive(pathname, child.href);
                      return <Link key={child.href} href={child.href} prefetch={false} className={`nav-subitem nav-nested-link${active && child.href !== item.href ? " nav-subitem-active" : ""}`} aria-current={active && child.href !== item.href ? "page" : undefined} onClick={closeMobileNavigation}>{child.label}</Link>;
                    })}</div>
                  </div>;
                }
                if (item.permission && !permissions.includes(item.permission)) return <span key={item.href} className="nav-subitem nav-subitem-disabled" aria-disabled="true" title="Finance permission is not connected yet">{item.label}<svg className="nav-lock" aria-hidden="true" viewBox="0 0 16 16"><rect x="3.5" y="7" width="9" height="7" rx="1.2" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg></span>;
                const active = routeIsActive(pathname, item.href);
                return <Link key={item.href} href={item.href} prefetch={false} className={`nav-subitem${active ? " nav-subitem-active" : ""}`} aria-current={active ? "page" : undefined} onClick={closeMobileNavigation}>{item.label}</Link>;
              })}
            </div>
          </section>;
        })}
      </nav>

      {!collapsed && <div className="sidebar-footer"><span className="sidebar-footer-mark" aria-hidden="true">B</span><span>Creative operations<br /><small>BABE AGENCY</small></span></div>}
    </aside>
  </>;
}
