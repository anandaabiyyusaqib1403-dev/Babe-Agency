import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";
import { loadEnvConfig } from "@next/env";
import { googleDriveOAuthFailureCode } from "../src/lib/google-drive-errors.mjs";

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the worker environment.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const pollIntervalMs = Math.max(2_000, Number(process.env.WORKER_POLL_INTERVAL_MS) || 10_000);
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const driveRefreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN_NEXT || process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
const sheetsEnabled = Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID && process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
const driveEnabled = Boolean(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID && process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && driveRefreshToken);

function html(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function log(event, detail = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...detail }));
}

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

function invoiceHtml(invoice, items) {
  const agency = invoice.agency_snapshot ?? {};
  const client = invoice.client_snapshot ?? {};
  const totals = invoice.totals_snapshot ?? {};
  const payment = invoice.payment_snapshot ?? {};
  const safeLogo = typeof agency.logo_url === "string" && /^https:\/\//i.test(agency.logo_url) ? `<img class="logo" src="${html(agency.logo_url)}" alt="">` : "";
  const itemRows = items.map(item => `<tr><td>${html(item.description)}</td><td>${html(item.quantity)}</td><td>${html(rupiah(item.unit_price))}</td><td>${html(rupiah(item.subtotal ?? Number(item.quantity) * Number(item.unit_price)))}</td></tr>`).join("");
  const optional = (label, value) => value ? `<div><dt>${html(label)}</dt><dd>${html(value)}</dd></div>` : "";
  const date = value => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(`${value}T00:00:00+07:00`)) : "â€”";
  const subtotal = Number(totals.subtotal ?? 0), discount = Number(totals.discount ?? 0), tax = Number(totals.tax_amount ?? 0), total = Number(totals.total ?? 0), paid = Number(payment.amount_paid ?? 0);
  const logoBlock = safeLogo ? `<div class="brand">${safeLogo}<div><strong>${html(agency.agency_name ?? "BABE AGENCY")}</strong><small>${html(agency.address ?? "")}</small><small>${html(agency.email ?? "")}${agency.phone ? ` · ${html(agency.phone)}` : ""}</small></div></div>` : `<div class="brand"><div><strong>${html(agency.agency_name ?? "BABE AGENCY")}</strong><small>${html(agency.address ?? "")}</small><small>${html(agency.email ?? "")}${agency.phone ? ` · ${html(agency.phone)}` : ""}</small></div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:17mm 15mm 19mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font:10pt/1.5 Arial,Helvetica,sans-serif;color:#272c28;margin:0}header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding:0 0 14px;margin-bottom:22px;border-bottom:2px solid #315f4d}.brand{display:flex;align-items:center;gap:12px}.logo{width:58px;height:58px;object-fit:contain}.brand strong{display:block;color:#263f34;font-size:12pt}.brand small{display:block;color:#5b655e;font-size:8pt}.invoice-title{text-align:right}.invoice-title h1{margin:0 0 5px;color:#263f34;font-size:21pt;line-height:1.1}.invoice-title strong{font-size:10pt}.client{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:22px}.client h2,.section-title{margin:0 0 6px;color:#263f34;font-size:10pt}.client p{margin:1px 0}.client .facts{display:grid;gap:4px}.client .facts div{display:grid;grid-template-columns:100px 1fr;gap:8px}.client dt{color:#5b655e}.client dd{margin:0}table{width:100%;border-collapse:collapse;font-size:9pt;margin:16px 0}thead{display:table-header-group}tr{break-inside:avoid}th,td{padding:8px 7px;border-bottom:1px solid #dfe4df;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{color:#5b655e;font-size:8pt;text-transform:uppercase;letter-spacing:.03em}th:nth-child(n+2),td:nth-child(n+2){text-align:right}.totals{display:grid;gap:5px;width:min(310px,100%);margin:0 0 22px auto}.totals div{display:flex;justify-content:space-between;gap:16px}.totals dt{color:#5b655e}.totals dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}.totals .total{padding-top:7px;border-top:1px solid #bcc7bf;color:#263f34;font-size:12pt;font-weight:700}.payment{margin-top:20px;padding-top:12px;border-top:1px solid #dfe4df}.payment p{margin:2px 0}.notes{margin-top:16px;white-space:pre-wrap}.signatory{margin:36px 0 0 auto;display:grid;gap:3px;width:220px;min-height:85px}.signatory small{color:#5b655e}.footer{font:8px Arial;width:100%;text-align:right;padding-right:15mm;color:#626a64}
  </style></head><body><header>${logoBlock}<div class="invoice-title"><h1>INVOICE</h1><strong>${html(invoice.invoice_number)}</strong></div></header><main><section class="client"><div><h2>BILLED TO</h2><p><strong>${html(client.brand_name ?? client.client_name ?? "Client")}</strong></p>${client.contact_person ? `<p>${html(client.contact_person)}</p>` : ""}${client.address ? `<p>${html(client.address)}</p>` : ""}${client.email ? `<p>${html(client.email)}</p>` : ""}${client.phone ? `<p>${html(client.phone)}</p>` : ""}</div><dl class="facts">${optional("Invoice date",date(invoice.invoice_date))}${optional("Due date",date(invoice.due_date))}${optional("Service period",invoice.service_period || (invoice.service_period_start||invoice.service_period_end ? `${date(invoice.service_period_start)} – ${date(invoice.service_period_end)}` : ""))}</dl></section><h2 class="section-title">SERVICE DETAILS</h2><table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${itemRows}</tbody></table><dl class="totals"><div><dt>Subtotal</dt><dd>${html(rupiah(subtotal))}</dd></div><div><dt>Discount</dt><dd>− ${html(rupiah(discount))}</dd></div>${tax>0?`<div><dt>Tax (${html((Number(totals.tax_rate??invoice.tax_rate)*100).toFixed(2))}%)</dt><dd>${html(rupiah(tax))}</dd></div>`:""}<div class="total"><dt>Total</dt><dd>${html(rupiah(total))}</dd></div><div><dt>Paid amount</dt><dd>${html(rupiah(paid))}</dd></div><div><dt>Remaining balance</dt><dd>${html(rupiah(Math.max(0,total-paid)))}</dd></div></dl>${payment.bank_name?`<section class="payment"><h2 class="section-title">PAYMENT INFORMATION</h2><p>${html(payment.bank_name)} · ${html(payment.bank_account_number??"")}</p><p>${html(payment.bank_account_holder??"")}</p>${payment.payment_terms?`<p>${html(payment.payment_terms)}</p>`:""}</section>`:""}${invoice.notes?`<section class="notes"><h2 class="section-title">NOTES</h2>${html(invoice.notes)}</section>`:""}${agency.authorized_signatory?`<section class="signatory"><small>Authorized by</small><strong>${html(agency.authorized_signatory)}</strong><small>${html(agency.signatory_title??"")}</small></section>`:""}</main></body></html>`;
}

async function setReminderFailure(event, error) {
  const failed = event.attempt_count >= 5;
  await supabase.from("task_reminder_events").update({
    status: failed ? "failed" : "pending",
    scheduled_at: failed ? event.scheduled_at : new Date(Date.now() + Math.min(15, 2 ** event.attempt_count) * 60_000).toISOString(),
    locked_until: null,
    last_error: String(error).slice(0, 500),
    updated_at: new Date().toISOString(),
  }).eq("id", event.id).eq("status", "sending");
}

async function googleAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_DRIVE_CLIENT_ID, client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET, refresh_token: driveRefreshToken, grant_type: "refresh_token" }), cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    let code = "";
    try { code = String((await response.json()).error ?? ""); } catch { /* Ignore provider response details. */ }
    throw new Error(googleDriveOAuthFailureCode(code));
  }
  const token = await response.json();
  if (!token.access_token) throw new Error("google_access_token_missing");
  return token.access_token;
}

async function findOrCreateDriveFolder(token, name, parentId) {
  const query = `name = '${String(name).replaceAll("'", "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;
  const params = new URLSearchParams({ q: query, fields: "files(id)", pageSize: "10", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
  const listed = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!listed.ok) throw new Error("invoice_drive_folder_lookup_failed");
  const result = await listed.json();
  if (result.files?.[0]?.id) return result.files[0].id;
  const created = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }), cache: "no-store" });
  if (!created.ok) throw new Error("invoice_drive_folder_create_failed");
  const folder = await created.json();
  if (!folder.id) throw new Error("invoice_drive_folder_id_missing");
  return folder.id;
}

async function queueReminderInSheets(event, task, member, client) {
  if (!sheetsEnabled) throw new Error("google_sheets_queue_not_configured");
  const token = await googleAccessToken();
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(process.env.GOOGLE_SHEETS_SPREADSHEET_ID)}/values`;
  const worksheet = process.env.GOOGLE_SHEETS_WORKSHEET || "Reminder Queue";
  const sheetRange = range => encodeURIComponent(`'${worksheet.replaceAll("'", "''")}'!${range}`);
  const headers = { Authorization: `Bearer ${token}` };
  const existing = await fetch(`${base}/${sheetRange("A:A")}?majorDimension=COLUMNS`, { headers, cache: "no-store" });
  if (!existing.ok) throw new Error(`sheets_lookup_http_${existing.status}`);
  const values = await existing.json();
  const ids = values.values?.[0] ?? [];
  const offsetLabel = event.reminder_offset_days === 0 ? "H" : `H-${event.reminder_offset_days}`;
  const due = new Date(`${task.due_date}T00:00:00+07:00`);
  const localDue = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(due);
  const subject = `[BABE AGENCY] ${offsetLabel} deadline: ${task.title}`;
  const body = ["BABE AGENCY — Task Reminder", `Task: ${task.title}`, `Client: ${client?.brand_name ?? "Agency task"}`, `PIC: ${member.full_name} (${member.email})`, `Deadline: ${localDue} (09.00 WIB)`, `Status: ${task.status.replaceAll("_", " ")}`, `Buka aplikasi BABE AGENCY: ${appUrl}/tasks`].join("\n");
  const existingIndex = ids.findIndex((id,index) => index>0 && id===event.id);
  if (existingIndex>=0) return {subject,body,rowReference:`A${existingIndex+1}:L${existingIndex+1}`};
  const row = [event.id, event.task_id, task.title, member.full_name, member.email, client?.brand_name ?? "", task.due_date, offsetLabel, subject, body, new Date().toISOString(), "Queued"];
  const appended = await fetch(`${base}/${sheetRange("A:L")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ values: [row] }), cache: "no-store" });
  if (!appended.ok) throw new Error(`sheets_append_http_${appended.status}`);
  const result = await appended.json();
  return {subject,body,rowReference:result.updates?.updatedRange ?? null};
}

async function processReminder(event) {
  try {
    const { data: task, error: taskError } = await supabase.from("tasks")
      .select("id,title,description,status,priority,due_date,reminder_enabled,assigned_to,client_id,archived_at,clients(brand_name)")
      .eq("id", event.task_id).maybeSingle();
    if (taskError) throw new Error("task_lookup_failed");
    if (!task || ["done","cancelled"].includes(task.status) || task.archived_at || !task.reminder_enabled || task.assigned_to !== event.recipient_member_id || task.due_date !== event.due_date_snapshot) {
      await supabase.from("task_reminder_events").update({ status: "cancelled", locked_until: null, last_error: "Task is no longer eligible for reminders." }).eq("id", event.id).eq("status", "sending");
      return;
    }
    const [{ data: member }, { data: preference }] = await Promise.all([
      supabase.from("agency_members").select("email,full_name,is_active").eq("id", event.recipient_member_id).maybeSingle(),
      supabase.from("task_notification_preferences").select("email_enabled").eq("member_id", event.recipient_member_id).maybeSingle(),
    ]);
    if (!member?.is_active || !member.email || preference?.email_enabled === false) {
      await supabase.from("task_reminder_events").update({ status: "skipped", locked_until: null, last_error: "PIC email is unavailable or email reminders are disabled." }).eq("id", event.id).eq("status", "sending");
      return;
    }

    const client = Array.isArray(task.clients) ? task.clients[0] : task.clients;
    const queued = await queueReminderInSheets(event, task, member, client);
    const { error: queueError } = await supabase.from("email_reminder_queue").upsert({
      reminder_id:event.id,recipient_email:member.email,recipient_name:member.full_name,email_subject:queued.subject,email_body:queued.body,
      google_sheets_row_reference:queued.rowReference,idempotency_key:`babe-reminder-${event.id}`,sync_status:"synced",synced_at:new Date().toISOString(),last_error:null,
    },{onConflict:"reminder_id"});
    if(queueError)throw new Error("reminder_queue_log_failed");
    const { error } = await supabase.from("task_reminder_events").update({
      status: "confirmation_required", provider: "google_sheets_zapier", provider_message_id: event.id, locked_until: null, last_error: null,
    }).eq("id", event.id).eq("status", "sending");
    if (error) throw new Error("reminder_delivery_log_failed");
    log("task_reminder_queued", { eventId: event.id, recipientMemberId: event.recipient_member_id });
  } catch (error) {
    await setReminderFailure(event, error instanceof Error ? error.message : "email_send_failed");
    log("task_reminder_failed", { eventId: event.id, reason: error instanceof Error ? error.message : "email_send_failed" });
  }
}

function renderSnapshot(snapshot, version) {
  const client = snapshot.client?.brand_name ?? "BABE AGENCY client";
  const period = snapshot.period ?? {};
  const narrative = snapshot.narrative ?? {};
  const rows = snapshot.items ?? snapshot.contents ?? [];
  const tasks = snapshot.tasks ?? [];
  const metrics = snapshot.metrics ?? {};
  const metricFields = [
    ["Unique contents", metrics.content_count], ["Publications", metrics.publication_count], ["Reach", metrics.reach],
    ["Impressions", metrics.impressions], ["Views", metrics.views], ["Interactions", metrics.interactions],
    ["Engagement rate by reach", metrics.engagement_rate_by_reach == null ? "N/A" : `${metrics.engagement_rate_by_reach}%`],
  ].filter(([, value]) => value !== undefined);
  const listTable = (items, headers, values) => items.length ? `<table><thead><tr>${headers.map(item => `<th>${html(item)}</th>`).join("")}</tr></thead><tbody>${items.map(item => `<tr>${values.map(key => `<td>${html(item[key] ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table>` : `<p>No records were selected for this section.</p>`;
  const narrativeBlocks = Object.entries(narrative).map(([label, text]) => text ? `<section><h2>${html(label.replaceAll("_", " "))}</h2><p>${html(text).replaceAll("\n", "<br>")}</p></section>` : "").join("");
  const metricsBlock = metricFields.length ? `<section><h2>Performance summary</h2><div class="metrics">${metricFields.map(([label, value]) => `<div><span>${html(label)}</span><strong>${html(value)}</strong></div>`).join("")}</div><p class="note">Engagement rate by reach = (likes + comments + shares + saves) / reach × 100%. N/A when reach is zero or missing.</p></section>` : "";
  const reportRows = rows.length ? listTable(rows, snapshot.reportType === "social" ? ["Content", "Platform", "Published", "Reach", "Impressions", "Views", "Interactions", "ER by reach", "Evaluation"] : ["Content", "Type", "Status", "Created"], snapshot.reportType === "social" ? ["content_title", "platform", "published_at", "reach", "impressions", "views", "interactions", "engagement_rate_by_reach", "evaluation"] : ["title", "content_type", "status", "created_at"]) : "";
  const tasksBlock = tasks.length ? `<section><h2>Agency work</h2>${listTable(tasks, ["Task", "Status", "Priority", "Deadline"], ["title", "status", "priority", "due_date"])}</section>` : "";
  const contentBlock = reportRows ? `<section><h2>${snapshot.reportType === "social" ? "Selected publication snapshots" : "Content produced during the period"}</h2>${reportRows}</section>` : "";
  const now = new Date(snapshot.calculated_at ?? Date.now()).toLocaleString("en", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:18mm 16mm 20mm}*{box-sizing:border-box}body{font:10pt/1.5 Arial,Helvetica,sans-serif;color:#262a27;margin:0}header{border-bottom:2px solid #315f4d;padding-bottom:12px;margin-bottom:22px}header strong{font-size:11pt;letter-spacing:.04em;color:#263f34}header small{display:block;margin-top:4px;color:#626a64;font-size:8pt}h1{font-size:22pt;line-height:1.2;margin:0 0 6px;color:#263f34}h2{font-size:13pt;margin:18px 0 8px;color:#263f34;break-after:avoid}p{margin:5px 0 10px}dl{display:grid;grid-template-columns:90px 1fr;gap:3px 10px;margin:12px 0}dt{font-weight:700;color:#626a64}dd{margin:0}table{width:100%;border-collapse:collapse;font-size:8.5pt}thead{display:table-header-group}tr{break-inside:avoid}th,td{border-bottom:1px solid #dfe4df;padding:7px 6px;vertical-align:top;text-align:left;overflow-wrap:anywhere}th{color:#626a64;font-size:8pt}section{break-inside:auto}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.metrics div{border:1px solid #dfe4df;border-radius:5px;padding:8px}.metrics span,.metrics strong{display:block}.metrics span{color:#626a64;font-size:8pt;text-transform:capitalize}.metrics strong{font-size:12pt;margin-top:4px}.note{font-size:8pt;color:#626a64}.footer{font-size:8pt;color:#626a64;width:100%;text-align:right}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  </style></head><body><header><strong>BABE AGENCY</strong><small>INTERNAL CREATIVE AGENCY MANAGEMENT SYSTEM</small></header><main><h1>${html(snapshot.reportType === "social" ? "Social Media Report" : "Monthly Report")}</h1><p><strong>${html(client)}</strong></p><dl><dt>Period</dt><dd>${html(period.start ?? "")} to ${html(period.end ?? "")}</dd>${snapshot.platform ? `<dt>Platform</dt><dd>${html(snapshot.platform)}</dd>` : ""}${snapshot.account_label ? `<dt>Account</dt><dd>${html(snapshot.account_label)}</dd>` : ""}<dt>Version</dt><dd>${html(version)}</dd></dl>${metricsBlock}${narrativeBlocks}${contentBlock}${tasksBlock}<p class="note">Snapshot calculated ${html(now)} · Source data and measurements are frozen for this version.</p></main></body></html>`;
}

async function processPdfJob(job) {
  let browser;
  try {
    if (!process.env.CHROMIUM_EXECUTABLE_PATH) throw new Error("CHROMIUM_EXECUTABLE_PATH is not configured for the PDF worker.");
    const isInvoice = job.report_type === "invoice";
    const isMonthly = job.report_type === "monthly";
    let pageHtml, versionId;
    if (isInvoice) {
      versionId = job.invoice_id;
      const { data: revision, error: revisionError } = await supabase.from("invoice_revisions").select("snapshot").eq("invoice_id",job.invoice_id).order("version",{ascending:false}).limit(1).maybeSingle();
      if (revisionError || !revision?.snapshot?.invoice) throw new Error("invoice_issue_snapshot_lookup_failed");
      const invoice = revision.snapshot.invoice;
      const items = revision.snapshot.items;
      if (!invoice.agency_snapshot || !invoice.client_snapshot || !invoice.totals_snapshot) throw new Error("invoice_snapshot_missing");
      pageHtml = invoiceHtml(invoice, Array.isArray(items)?items:[]);
    } else {
      versionId = isMonthly ? job.monthly_report_version_id : job.social_report_version_id;
      const table = isMonthly ? "monthly_report_versions" : "social_report_versions";
      const fk = isMonthly ? "monthly_report_id" : "social_report_id";
      const { data: version, error } = await supabase.from(table).select(`id,version_number,snapshot_data,${fk}`).eq("id", versionId).maybeSingle();
      if (error || !version) throw new Error("report_version_lookup_failed");
      pageHtml = renderSnapshot(version.snapshot_data, `v${version.version_number}`);
    }
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.setContent(pageHtml, { waitUntil: "networkidle" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: "<div class='footer' style='font:8px Arial;width:100%;text-align:right;padding-right:16mm;color:#626a64'>BABE AGENCY · Page <span class='pageNumber'></span> of <span class='totalPages'></span></div>", margin: { top: "18mm", right: "16mm", bottom: "20mm", left: "16mm" } });
    await browser.close();
    browser = undefined;
    if (pdf.length < 500 || pdf.subarray(0, 5).toString() !== "%PDF-") throw new Error("rendered_pdf_validation_failed");
    const filePath = isInvoice ? `invoice/${job.invoice_id}.pdf` : `${job.report_type}/${versionId}.pdf`;
    const { error: uploadError } = await supabase.storage.from("agency-reports").upload(filePath, pdf, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error("report_pdf_upload_failed");
    let driveWarning = null;
    if (driveEnabled) {
      try {
        const category = isInvoice ? "invoices" : "reports";
        let clientId = null;
        let clientName = "Agency";
        let displayName = "";
        let description = "";
        let appProperties = { babePdfJobId: job.id };
        if (isInvoice) {
          const { data: invoice, error: invoiceError } = await supabase.from("invoices").select("id,invoice_number,client_id,client_snapshot").eq("id", job.invoice_id).single();
          if (invoiceError || !invoice) throw new Error("invoice_drive_source_lookup_failed");
          clientId = invoice.client_id;
          clientName = invoice.client_snapshot?.brand_name || invoice.client_snapshot?.client_name || "Client";
          displayName = `${invoice.invoice_number}.pdf`;
          description = "Generated invoice PDF";
          appProperties = { babePdfJobId: job.id, babeInvoiceId: invoice.id };
        } else {
          const reportType = isMonthly ? "monthly" : "social";
          const versionTable = isMonthly ? "monthly_report_versions" : "social_report_versions";
          const reportForeignKey = isMonthly ? "monthly_report_id" : "social_report_id";
          const reportTable = isMonthly ? "monthly_reports" : "social_reports";
          const { data: version } = await supabase.from(versionTable).select(`id,version_number,${reportForeignKey}`).eq("id", versionId).single();
          if (!version) throw new Error("report_drive_source_lookup_failed");
          const { data: report } = await supabase.from(reportTable).select("client_id,platform,period_start,period_end").eq("id", version[reportForeignKey]).single();
          if (!report) throw new Error("report_drive_source_lookup_failed");
          clientId = report.client_id;
          const { data: client } = await supabase.from("clients").select("brand_name").eq("id", clientId).maybeSingle();
          clientName = client?.brand_name || "Client";
          const label = reportType === "monthly" ? "Monthly Report" : `${String(report.platform || "Social")} Report`;
          displayName = `${label} ${report.period_start}_${report.period_end} v${version.version_number}.pdf`;
          description = `Finalized ${reportType} report PDF, version ${version.version_number}`;
          appProperties = { babePdfJobId: job.id, babeReportType: reportType, babeReportVersionId: version.id };
        }
        const { data: categoryRow } = await supabase.from("document_categories").select("id,label,drive_folder_id").eq("id", category).single();
        if (!categoryRow) throw new Error("drive_category_not_configured");
        const token = await googleAccessToken();
        let folderId = categoryRow?.drive_folder_id;
        if (!folderId) {
          folderId = await findOrCreateDriveFolder(token, "01 Invoices & Payment Proofs", process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
          await supabase.from("document_categories").update({ drive_folder_id: folderId }).eq("id", category);
        }
        if (clientId) folderId = await findOrCreateDriveFolder(token, `${clientName} (${clientId.slice(0, 8)})`, folderId);
        const search = new URLSearchParams({ q: `appProperties has { key='babePdfJobId' and value='${job.id}' } and trashed = false`, fields: "files(id,name,webViewLink)", pageSize: "10", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
        const foundResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${search}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!foundResponse.ok) throw new Error("invoice_drive_pdf_lookup_failed");
        const found = await foundResponse.json();
        let file;
        const existing = found.files?.[0];
        const fileMetadata = { name: displayName, description, mimeType: "application/pdf", appProperties };
        const createMetadata = { ...fileMetadata, parents: [folderId] };
        const boundary = `babe_${job.id.replaceAll("-", "")}`;
        const multipart = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(existing ? fileMetadata : createMetadata)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`), pdf, Buffer.from(`\r\n--${boundary}--`)]);
        const uploadUrl = existing
          ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,parents&supportsAllDrives=true`
          : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,parents&supportsAllDrives=true`;
        const response = await fetch(uploadUrl, { method: existing ? "PATCH" : "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body: multipart, cache: "no-store" });
        if (!response.ok) throw new Error("invoice_drive_pdf_upload_failed");
        file = await response.json();
        const { error: docError } = await supabase.from("agency_documents").upsert({ name: file.name || displayName, category_id: category, client_id: clientId, invoice_id: isInvoice ? job.invoice_id : null, report_pdf_job_id: isInvoice ? null : job.id, description, drive_file_id: file.id, drive_folder_id: folderId, web_view_link: file.webViewLink ?? null, mime_type: file.mimeType || "application/pdf", size_bytes: Number(file.size || pdf.length), uploaded_by: job.created_by, storage_provider: "google_drive" }, { onConflict: "drive_file_id" });
        if (docError) {
          await supabase.from("agency_document_upload_orphans").upsert({ drive_file_id: file.id, drive_folder_id: folderId, file_name: displayName, category_id: category, uploaded_by: job.created_by, metadata_error: docError.message.slice(0, 500) }, { onConflict: "drive_file_id" });
          throw new Error("drive_pdf_metadata_failed");
        }
        if (isInvoice) await supabase.from("invoices").update({ pdf_drive_file_id: file.id }).eq("id", job.invoice_id);
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        driveWarning = code === "google_drive_reauth_required"
          ? "Google Drive authorization expired. Run npm run drive:authorize and complete consent; the private PDF copy is still available."
          : code === "google_drive_oauth_client_invalid"
            ? "Google Drive OAuth client settings are invalid; check the server environment and Google Cloud OAuth client. The private PDF copy is still available."
            : "Google Drive could not confirm a PDF copy; the private PDF remains available in application storage.";
      }
    }
    const { error: completeError } = await supabase.from("report_pdf_jobs").update({ status: "completed", file_path: filePath, last_error: driveWarning, locked_until: null, updated_at: new Date().toISOString() }).eq("id", job.id).eq("status", "processing");
    if (completeError) throw new Error("report_pdf_status_update_failed");
    log("report_pdf_completed", { jobId: job.id, reportType: job.report_type, versionId, bytes: pdf.length, driveWarning });
  } catch (error) {
    if (browser) await browser.close().catch(() => undefined);
    const final = job.attempt_count >= 3;
    const reason = error instanceof Error ? error.message : "report_pdf_failed";
    await supabase.from("report_pdf_jobs").update({ status: final ? "failed" : "queued", next_attempt_at: new Date(Date.now() + Math.min(5, 2 ** job.attempt_count) * 60_000).toISOString(), locked_until: null, last_error: reason.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", job.id).eq("status", "processing");
    log("report_pdf_failed", { jobId: job.id, attempt: job.attempt_count, reason });
  }
}

async function drain() {
  if (sheetsEnabled) {
    const { data: events, error } = await supabase.rpc("claim_due_task_reminders", { p_batch_size: 20 });
    if (error) log("reminder_queue_read_failed", { code: error.code });
    for (const event of events ?? []) await processReminder(event);
  }
  if (process.env.CHROMIUM_EXECUTABLE_PATH) {
    const { data: jobs, error } = await supabase.rpc("claim_report_pdf_jobs", { p_batch_size: 2 });
    if (error) log("report_queue_read_failed", { code: error.code });
    for (const job of jobs ?? []) await processPdfJob(job);
  }
}

log("worker_started", { sheetsQueueEnabled: sheetsEnabled, pdfEnabled: Boolean(process.env.CHROMIUM_EXECUTABLE_PATH), invoiceDriveEnabled: driveEnabled, pollIntervalMs });
if (!sheetsEnabled) log("reminder_queue_disabled", { reason: "Configure Google Sheets and server-side Google OAuth credentials." });
if (!process.env.CHROMIUM_EXECUTABLE_PATH) log("pdf_worker_disabled", { reason: "Install Chromium on the worker host and set CHROMIUM_EXECUTABLE_PATH." });

let stopped = false;
process.on("SIGINT", () => { stopped = true; });
process.on("SIGTERM", () => { stopped = true; });
while (!stopped) {
  try { await drain(); } catch (error) { log("worker_iteration_failed", { reason: error instanceof Error ? error.message : "unknown" }); }
  if (!stopped) await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
}
log("worker_stopped");
