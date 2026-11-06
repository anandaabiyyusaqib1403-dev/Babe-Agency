import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
  loading?: boolean;
};

export function Button({ variant = "secondary", className = "", type = "button", loading = false, disabled, children, ...props }: ButtonProps) {
  return <button type={type} className={`ui-button ui-button-${variant}${loading ? " ui-button-loading" : ""} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading && <span className="ui-button-spinner" aria-hidden="true" />}{children}
  </button>;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ui-input ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ui-input ui-textarea ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`ui-input ui-select ${className}`} {...props}>{children}</select>;
}

type CheckProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function Checkbox({ className = "", ...props }: CheckProps) {
  return <input type="checkbox" className={`ui-check ${className}`} {...props} />;
}

export function Radio({ className = "", ...props }: CheckProps) {
  return <input type="radio" className={`ui-check ${className}`} {...props} />;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}

export function Avatar({ name, className = "" }: { name: string; className?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  return <span className={`ui-avatar ${className}`} role="img" aria-label={name}>{initials || "?"}</span>;
}

export function Alert({ tone = "info", title, children, className = "" }: { tone?: "success" | "warning" | "danger" | "info"; title?: string; children: ReactNode; className?: string }) {
  return <section className={`ui-alert ui-alert-${tone} ${className}`} role={tone === "danger" ? "alert" : "status"}>
    <span className="ui-alert-marker" aria-hidden="true">{tone === "success" ? "✓" : tone === "warning" ? "!" : tone === "danger" ? "×" : "i"}</span>
    <div>{title && <strong>{title}</strong>}<div>{children}</div></div>
  </section>;
}

export function Card({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={`ui-card ${className}`} {...props}>{children}</section>;
}

export function Table({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) {
  return <div className="ui-table-wrap" role="region" aria-label={label ?? "Scrollable data table"} tabIndex={0}><table className={`ui-table ${className}`}>{children}</table></div>;
}

export function SearchBar({ label, placeholder, name = "q", className = "" }: { label: string; placeholder: string; name?: string; className?: string }) {
  return <label className={`ui-search-bar ${className}`}>
    <svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
    <span className="visually-hidden">{label}</span>
    <input type="search" name={name} aria-label={label} placeholder={placeholder} />
  </label>;
}

export function FilterBar({ children, label = "Filters", className = "" }: { children: ReactNode; label?: string; className?: string }) {
  return <div className={`ui-filter-bar ${className}`} role="group" aria-label={label}>{children}</div>;
}

export function PageHeader({ title, description, eyebrow, actions }: { title: string; description?: string; eyebrow?: string; actions?: ReactNode }) {
  return <header className="ui-page-header"><div>{eyebrow && <p>{eyebrow}</p>}<h1>{title}</h1>{description && <span>{description}</span>}</div>{actions && <div className="ui-page-header-actions">{actions}</div>}</header>;
}

export function DetailPanel({ title, children, className = "", ...props }: HTMLAttributes<HTMLElement> & { title: string; children: ReactNode }) {
  return <aside className={`ui-detail-panel ${className}`} aria-label={title} {...props}><h2>{title}</h2>{children}</aside>;
}

export function Tabs({ children, label = "Section tabs" }: { children: ReactNode; label?: string }) {
  return <nav className="ui-tabs" aria-label={label}>{children}</nav>;
}

export function Dropdown({ label, children }: { label: string; children: ReactNode }) {
  return <details className="ui-dropdown"><summary>{label}<span className="ui-dropdown-caret" aria-hidden="true" /></summary><div className="ui-dropdown-menu">{children}</div></details>;
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return <span className="ui-tooltip" title={label}>{children}</span>;
}

export function Pagination({ page, pages, onPageChange }: { page: number; pages: number; onPageChange: (page: number) => void }) {
  return <nav className="ui-pagination" aria-label="Pagination">
    <Button disabled={page <= 1} aria-label="Previous page" onClick={() => onPageChange(page - 1)}>Previous</Button>
    <span aria-live="polite">Page {page} of {pages}</span>
    <Button disabled={page >= pages} aria-label="Next page" onClick={() => onPageChange(page + 1)}>Next</Button>
  </nav>;
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return <nav className="ui-breadcrumb" aria-label="Breadcrumb">
    <ol>{items.map((item, index) => <li key={`${item.label}-${index}`}>
      {index > 0 && <span aria-hidden="true">/</span>}
      {item.href && index < items.length - 1 ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
    </li>)}</ol>
  </nav>;
}

export function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-skeleton ${className}`} aria-hidden="true" {...props} />;
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <div className="ui-loading" role="status"><span className="ui-loading-indicator" aria-hidden="true" />{label}</div>;
}

export function EmptyState({ title, children, action, className = "" }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={`ui-empty-state ${className}`}>
    <h2>{title}</h2>
    <p>{children}</p>
    {action}
  </section>;
}

