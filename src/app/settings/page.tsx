import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button, EmptyState, Input, Select, Textarea } from "@/components/ui";
import { saveAgencySettingsAction, saveBillingProfileAction, saveTaskNotificationPreferenceAction } from "@/app/actions/settings-actions";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";
import { SetupNotice } from "@/components/setup-notice";
import "./settings.css";

const sections = [
  ["profile", "My Profile"], ["agency", "Agency Profile"], ["members", "Team & Members"],
  ["billing", "Billing Information"], ["integrations", "Integrations"], ["notifications", "Notifications"],
  ["preferences", "Preferences"], ["security", "Security"],
] as const;
const descriptions: Record<string, string> = {
  profile: "Your account details and agency membership.", agency: "Workspace identity and regional defaults.",
  members: "People who can access the agency workspace.", billing: "Business and payment identity used for new invoices.",
  integrations: "Verified connection status for external services.", notifications: "Personal email preference for task reminders.",
  preferences: "Regional display settings for the workspace.", security: "Authentication and access to your account.",
};
const integrationRows = [
  ["Supabase", "Database and authentication are responding to this signed-in session.", "Connected"],
  ["Google Drive", "No verifiable Drive connection is configured in this application.", "Configuration Required"],
  ["Google Sheets", "Reminder queue data may be available; this does not verify Gmail delivery.", "Configuration Required"],
  ["Zapier + Gmail", "Queue presence does not confirm an active Zap or successful email delivery.", "Confirmation Required"],
  ["Instagram Graph API", "Connect credentials and permissions through a secure backend setup.", "Not Connected"],
  ["TikTok API", "Connect credentials and permissions through a secure backend setup.", "Not Connected"],
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="settings-field"><span>{label}</span>{children}</label>;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) return <SetupNotice />;
  const params = await searchParams;
  const sectionParam = typeof params.section === "string" ? params.section : "profile";
  const section = sections.some(([key]) => key === sectionParam) ? sectionParam : "profile";
  const saved = params.saved === "1";
  const [{ data: agency }, { data: billing }, { data: preferences }, { data: access }] = await Promise.all([
    ctx.supabase.from("agency_settings").select("agency_name,timezone,currency,date_format").eq("is_singleton", true).maybeSingle(),
    ctx.supabase.from("agency_billing_profiles").select("agency_name,address,email,phone,bank_name,bank_account_number,bank_account_holder,authorized_signatory,signatory_title,default_payment_terms,tax_configuration").eq("is_singleton", true).maybeSingle(),
    ctx.supabase.from("task_notification_preferences").select("email_enabled").eq("member_id", ctx.user.id).maybeSingle(),
    ctx.supabase.from("agency_members").select("role").eq("id", ctx.user.id).maybeSingle(),
  ]);
  const canManage = ["owner", "admin"].includes(access?.role ?? "");
  const memberResult = section === "members" && canManage
    ? await ctx.supabase.from("agency_members").select("id,full_name,email,role,is_active,joined_at").order("full_name").limit(100)
    : { data: null, error: null };
  const memberCount = memberResult?.data?.length ?? 0;
  const email = ctx.user.email ?? ctx.member.email ?? "Not available";
  const provider = typeof ctx.user.app_metadata.provider === "string" ? ctx.user.app_metadata.provider : "Supabase Auth";
  const initials = ctx.member.full_name.trim().split(/\s+/).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase() || "BA";

  return <WorkspaceShell title="Studio Settings" section="Settings / Studio Settings" memberName={ctx.member.full_name} memberEmail={email}>
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections">
        <p className="settings-nav-heading">SETTINGS</p>
        {sections.map(([key, label]) => <Link key={key} href={`/settings?section=${key}`} aria-current={section === key ? "page" : undefined} className={section === key ? "settings-nav-link settings-nav-active" : "settings-nav-link"}>{label}</Link>)}
      </nav>
      <section className="settings-content" aria-labelledby="settings-title">
        <header className="settings-section-heading"><div><h2 id="settings-title">{sections.find(([key]) => key === section)?.[1]}</h2><p>{descriptions[section]}</p></div></header>
        {saved && <p className="settings-notice settings-success" role="status">Changes saved.</p>}

        {section === "profile" && <div className="settings-panel">
          <div className="settings-profile-head"><span className="settings-avatar" aria-hidden="true">{initials}</span><div><strong>{ctx.member.full_name}</strong><span>{email}</span></div><span className="settings-status">{ctx.member.is_active ? "Active" : "Inactive"}</span></div>
          <dl className="settings-details"><div><dt>Full name</dt><dd>{ctx.member.full_name}</dd></div><div><dt>Email address</dt><dd>{email}</dd></div><div><dt>Role</dt><dd>{access?.role ?? "Member"}</dd></div><div><dt>Account created</dt><dd>{ctx.user.created_at ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(ctx.user.created_at)) : "Not available"}</dd></div></dl>
          <p className="settings-note">Profile photo, phone number, and job title are not available in the current profile schema. Email changes require Supabase Auth verification.</p>
        </div>}

        {section === "agency" && <form action={saveAgencySettingsAction} className="settings-panel settings-form">
          <p className="settings-subheading">Workspace identity</p>
          <Field label="Agency name"><Input name="agency_name" defaultValue={agency?.agency_name ?? "BABE AGENCY"} required minLength={2} maxLength={120} /></Field>
          <p className="settings-note">Logo, description, website, social links, and business contact details do not have fields in the current workspace settings schema.</p>
          <p className="settings-subheading">Regional defaults</p>
          <div className="settings-form-grid"><Field label="Timezone"><Input name="timezone" defaultValue={agency?.timezone ?? "Asia/Jakarta"} required /></Field><Field label="Currency"><Input name="currency" defaultValue={agency?.currency ?? "IDR"} required maxLength={3} /></Field><Field label="Date format"><Select name="date_format" defaultValue={agency?.date_format ?? "dd MMM yyyy"}><option value="dd MMM yyyy">05 Nov 2026</option><option value="yyyy-MM-dd">2026-11-05</option><option value="MM/dd/yyyy">11/05/2026</option></Select></Field></div>
          <div className="settings-actions"><Button variant="primary" type="submit">Save Changes</Button></div>
        </form>}

        {section === "members" && (canManage ? memberResult === null ? <p className="settings-error" role="alert">The member directory is unavailable. Refresh and try again.</p> : memberResult.error ? <p className="settings-error" role="alert">Members could not be loaded. Refresh and try again.</p> : memberCount ? <div className="settings-panel"><p className="settings-note">Showing up to 100 members. Invitation and membership changes require a secure Auth invitation flow that is not configured here.</p><div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>Member</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead><tbody>{(memberResult.data ?? []).map(member => <tr key={member.id}><td>{member.full_name}</td><td>{member.email || "—"}</td><td><span className="settings-role">{member.role}</span></td><td>{member.is_active ? "Active" : "Inactive"}</td><td>{member.joined_at ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(member.joined_at)) : "—"}</td></tr>)}</tbody></table></div></div> : <EmptyState title="No member records">There are no members available to display.</EmptyState> : <EmptyState title="Access restricted">Only agency owners and administrators can view the member directory.</EmptyState>)}

        {section === "billing" && (canManage ? <form action={saveBillingProfileAction} className="settings-panel settings-form">
          <p className="settings-subheading">Business identity</p><div className="settings-form-grid"><Field label="Agency name"><Input name="agency_name" defaultValue={billing?.agency_name ?? ""} maxLength={160} /></Field><Field label="Billing email"><Input name="email" type="email" defaultValue={billing?.email ?? ""} maxLength={254} /></Field><Field label="Phone"><Input name="phone" defaultValue={billing?.phone ?? ""} maxLength={40} /></Field></div><Field label="Business address"><Textarea name="address" defaultValue={billing?.address ?? ""} rows={3} maxLength={1200} /></Field>
          <p className="settings-subheading">Bank information</p><div className="settings-form-grid"><Field label="Bank name"><Input name="bank_name" defaultValue={billing?.bank_name ?? ""} maxLength={120} /></Field><Field label="Account number"><Input name="bank_account_number" defaultValue={billing?.bank_account_number ?? ""} maxLength={80} autoComplete="off" /></Field><Field label="Account holder"><Input name="bank_account_holder" defaultValue={billing?.bank_account_holder ?? ""} maxLength={160} /></Field></div>
          <p className="settings-subheading">Invoice authorization</p><div className="settings-form-grid"><Field label="Authorized signatory"><Input name="authorized_signatory" defaultValue={billing?.authorized_signatory ?? ""} maxLength={160} /></Field><Field label="Signatory title"><Input name="signatory_title" defaultValue={billing?.signatory_title ?? ""} maxLength={120} /></Field></div><Field label="Default payment terms"><Textarea name="default_payment_terms" defaultValue={billing?.default_payment_terms ?? ""} rows={2} maxLength={500} /></Field>
          <p className="settings-subheading">Tax configuration</p><div className="settings-form-grid"><label className="settings-toggle-row"><span>Enable configured tax</span><input type="checkbox" name="tax_enabled" defaultChecked={taxConfiguration(billing?.tax_configuration).enabled}/></label><Field label="Configured tax rate (%)"><Input name="tax_rate_percent" type="number" min="0" max="100" step="0.01" defaultValue={taxConfiguration(billing?.tax_configuration).rate*100}/></Field></div>
          <p className="settings-note">Tax is applied only when this setting is enabled. Changes apply to new invoices; finalized invoice snapshots remain unchanged.</p><div className="settings-actions"><Button variant="primary" type="submit">Save Changes</Button></div>
        </form> : <EmptyState title="Access restricted">Only agency owners and administrators can view or update billing information.</EmptyState>)}

        {section === "integrations" && <div className="settings-panel settings-integrations">{integrationRows.map(([name, detail, status]) => <div className="settings-integration-row" key={name}><div><strong>{name}</strong><p>{detail}</p></div><span className={status === "Connected" ? "settings-status" : "settings-status settings-status-muted"}>{status}</span></div>)}<p className="settings-note">Connection tests and account linking are not available until provider credentials and backend flows are configured. No secrets are shown on this page.</p></div>}

        {section === "notifications" && <form action={saveTaskNotificationPreferenceAction} className="settings-panel settings-form"><p className="settings-subheading">Task reminder email</p><label className="settings-toggle-row"><span><strong>Send task reminders to my agency email</strong><small>Controls your personal reminder email preference.</small></span><input type="checkbox" name="email_enabled" defaultChecked={preferences?.email_enabled ?? true} /></label><p className="settings-note">The shared reminder schedule remains H-3, H-1, and H at 09:00 Asia/Jakarta. Other task, approval, and finance notification preferences are not supported by the current schema.</p><div className="settings-actions"><Button variant="primary" type="submit">Save Changes</Button></div></form>}

        {section === "preferences" && <div className="settings-panel"><p className="settings-subheading">Regional settings</p><dl className="settings-details"><div><dt>Timezone</dt><dd>{agency?.timezone ?? "Asia/Jakarta"}</dd></div><div><dt>Date format</dt><dd>{agency?.date_format ?? "dd MMM yyyy"}</dd></div><div><dt>Currency</dt><dd>{agency?.currency ?? "IDR"}</dd></div><div><dt>Time format</dt><dd>24-hour (workspace default)</dd></div></dl><p className="settings-note">Regional values are managed by an agency administrator under Agency Profile. Personal display preferences, table rows, and calendar view are not persisted by the current schema.</p><Link className="ui-button" href="/settings?section=agency">Open Agency Profile</Link></div>}

        {section === "security" && <div className="settings-panel"><p className="settings-subheading">Password management</p><p className="settings-note">Passwords are managed by Supabase Auth. Use the secure password recovery flow to set a new password.</p><Link className="ui-button ui-button-primary" href="/auth/forgot-password">Reset password</Link><p className="settings-subheading settings-spaced">Current account</p><dl className="settings-details"><div><dt>Email</dt><dd>{email}</dd></div><div><dt>Status</dt><dd>{ctx.member.is_active ? "Active agency member" : "Inactive"}</dd></div><div><dt>Authentication provider</dt><dd>{provider}</dd></div></dl><Link className="ui-button settings-signout" href="/auth/signout">Sign out</Link><p className="settings-note">Other-session sign out is not exposed by the current authentication setup.</p></div>}
      </section>
    </div>
  </WorkspaceShell>;
}

function taxConfiguration(value:unknown){if(!value||typeof value!=="object"||Array.isArray(value))return {enabled:false,rate:0};const config=value as Record<string,unknown>;const rate=typeof config.rate==="number"&&config.rate>=0&&config.rate<=1?config.rate:0;return {enabled:config.enabled===true&&rate>0,rate};}
