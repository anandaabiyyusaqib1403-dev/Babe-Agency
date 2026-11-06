"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";

const taskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional(),
  category: z.enum(["agency_task", "client_task"]),
  responsibility: z.enum(["agency", "client", "external"]),
  client_id: z.string().uuid().optional(),
  content_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["todo", "in_progress", "review", "done"]),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
  reminder_enabled: z.boolean(),
  dependency_notes: z.string().trim().max(2000).optional(),
});

function value(form: FormData, key: string) {
  const item = form.get(key);
  return typeof item === "string" ? item.trim() : "";
}

function optional(value: string) { return value || undefined; }

export async function createClientAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const brandName = value(form, "brand_name");
  if (brandName.length < 2 || brandName.length > 120) throw new Error("Client name must be between 2 and 120 characters.");
  const { error } = await ctx.supabase.from("clients").insert({ brand_name: brandName, created_by: ctx.user.id });
  if (error) throw new Error("Could not save the client. Check the name and try again.");
  revalidatePath("/clients");
  revalidatePath("/tasks");
  revalidatePath("/content");
  redirect("/clients?saved=1");
}

export async function archiveClientAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const id = value(form, "client_id");
  const { error } = await ctx.supabase.from("clients").update({ status: "archived" }).eq("id", id);
  if (error) throw new Error("Could not archive this client.");
  revalidatePath("/clients");
  revalidatePath("/tasks");
  revalidatePath("/content");
}

export async function createContentAndScheduleAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const clientId = value(form, "client_id");
  const title = value(form, "title");
  const contentType = value(form, "content_type");
  const platform = value(form, "platform");
  const scheduledAt = value(form, "scheduled_at");
  if (!z.string().uuid().safeParse(clientId).success || title.length < 2 || title.length > 160 || !contentType || !platform) throw new Error("Complete the client, content title, type, and platform.");
  const parsedScheduleDate = scheduledAt ? new Date(`${scheduledAt}:00+07:00`) : null;
  if (scheduledAt && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledAt) || !parsedScheduleDate || Number.isNaN(parsedScheduleDate.getTime()))) throw new Error("Enter a valid publication date and time.");
  const { data: content, error: contentError } = await ctx.supabase.from("contents").insert({
    client_id: clientId, title, content_type: contentType, created_by: ctx.user.id,
  }).select("id").single();
  if (contentError || !content) throw new Error("Could not create this content item.");
  const scheduledAtIso = parsedScheduleDate?.toISOString() ?? null;
  const { error: scheduleError } = await ctx.supabase.from("content_schedules").insert({
    content_id: content.id,
    client_id: clientId,
    platform,
    scheduled_at: scheduledAtIso,
  });
  if (scheduleError) {
    await ctx.supabase.from("contents").delete().eq("id", content.id);
    throw new Error("Could not save the publication schedule.");
  }
  revalidatePath("/content");
  revalidatePath("/performance");
  redirect("/content?saved=1");
}

export async function markContentPublishedAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const id = value(form, "schedule_id");
  const postUrl = value(form, "post_url");
  if (!z.string().uuid().safeParse(id).success) throw new Error("Choose a valid publication schedule.");
  if (postUrl && !z.string().url().safeParse(postUrl).success) throw new Error("Enter a valid post URL.");
  const { error } = await ctx.supabase.rpc("publish_content_schedule", { p_schedule_id: id, p_post_url: postUrl });
  if (error) throw new Error("Could not update the publication status.");
  revalidatePath("/content");
  revalidatePath("/performance");
}

export async function addPublicationScheduleAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const contentId = value(form,"content_id");
  const platform = value(form,"platform");
  const scheduledAt = value(form,"scheduled_at");
  const parsedDate = scheduledAt ? new Date(`${scheduledAt}:00+07:00`) : null;
  if (!z.string().uuid().safeParse(contentId).success || !platform || (scheduledAt && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledAt) || !parsedDate || Number.isNaN(parsedDate.getTime())))) throw new Error("Choose a content item, platform, and valid schedule.");
  const { data: content } = await ctx.supabase.from("contents").select("id,client_id").eq("id",contentId).maybeSingle();
  if (!content) throw new Error("This content item is no longer available.");
  const { error } = await ctx.supabase.from("content_schedules").insert({ content_id: content.id, client_id: content.client_id, platform, scheduled_at: parsedDate?.toISOString() ?? null });
  if (error) throw new Error("Could not add this publication schedule.");
  revalidatePath("/content");
  revalidatePath("/performance");
}

export async function createTaskAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const raw = {
    title: value(form, "title"),
    description: optional(value(form, "description")),
    category: value(form, "category"),
    responsibility: value(form, "responsibility"),
    client_id: optional(value(form, "client_id")),
    content_id: optional(value(form, "content_id")),
    assigned_to: value(form, "assigned_to"),
    priority: value(form, "priority"),
    status: value(form, "status"),
    start_date: optional(value(form, "start_date")),
    due_date: optional(value(form, "due_date")),
    reminder_enabled: form.get("reminder_enabled") === "on",
    dependency_notes: optional(value(form, "dependency_notes")),
  };
  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the task details.");
  if (parsed.data.category === "client_task" && !parsed.data.client_id) throw new Error("Choose a client for a client task.");
  if (parsed.data.category === "agency_task" && parsed.data.client_id) throw new Error("Agency tasks cannot be linked to a client.");
  if (parsed.data.content_id && !parsed.data.client_id) throw new Error("Choose the content item's client first.");
  const { error } = await ctx.supabase.from("tasks").insert({
    ...parsed.data,
    description: parsed.data.description || null,
    dependency_notes: parsed.data.dependency_notes || null,
    start_date: parsed.data.start_date || null,
    due_date: parsed.data.due_date || null,
    created_by: ctx.user.id,
  });
  if (error) throw new Error(error.code === "23503" ? "The selected client, content, or PIC is no longer available." : "Could not save this task. Check the task details and try again.");
  revalidatePath("/tasks");
  revalidatePath("/performance");
  redirect("/tasks?saved=1");
}

export async function updateTaskStatusAction(taskId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const status = value(form, "status");
  if (!["todo", "in_progress", "review", "done", "cancelled"].includes(status)) throw new Error("Choose a valid task status.");
  const { error } = await ctx.supabase.from("tasks").update({ status }).eq("id", taskId).is("archived_at", null);
  if (error) throw new Error("Could not update this task.");
  revalidatePath("/tasks");
  revalidatePath("/performance");
}

export async function updateTaskAction(taskId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const parsed = taskSchema.safeParse({
    title: value(form,"title"), description: optional(value(form,"description")), category: value(form,"category"), responsibility: value(form,"responsibility"),
    client_id: optional(value(form,"client_id")), content_id: optional(value(form,"content_id")), assigned_to: value(form,"assigned_to"),
    priority: value(form,"priority"), status: value(form,"status"), start_date: optional(value(form,"start_date")), due_date: optional(value(form,"due_date")),
    reminder_enabled: form.get("reminder_enabled") === "on", dependency_notes: optional(value(form,"dependency_notes")),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the task details.");
  if (parsed.data.category === "client_task" && !parsed.data.client_id) throw new Error("Choose a client for a client task.");
  if (parsed.data.category === "agency_task" && parsed.data.client_id) throw new Error("Agency tasks cannot be linked to a client.");
  if (parsed.data.content_id && !parsed.data.client_id) throw new Error("Choose the content item's client first.");
  const { error } = await ctx.supabase.from("tasks").update({ ...parsed.data,
    description: parsed.data.description || null, dependency_notes: parsed.data.dependency_notes || null,
    start_date: parsed.data.start_date || null, due_date: parsed.data.due_date || null,
  }).eq("id", taskId).is("archived_at", null);
  if (error) throw new Error("Could not update this task. Check the client, content, and PIC.");
  revalidatePath("/tasks");
  revalidatePath("/performance");
  redirect("/tasks?saved=1");
}

export async function archiveTaskAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const id = value(form, "task_id");
  const { error } = await ctx.supabase.from("tasks").update({ archived_at: new Date().toISOString() }).eq("id", id).is("archived_at", null);
  if (error) throw new Error("Could not archive this task.");
  revalidatePath("/tasks");
  revalidatePath("/performance");
}

export async function updateReminderPreferencesAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const { error } = await ctx.supabase.from("task_notification_preferences").upsert({
    member_id: ctx.user.id,
    email_enabled: form.get("email_enabled") === "on",
    reminder_offsets_days: [3, 1, 0],
    reminder_time: "09:00",
    timezone: "Asia/Jakarta",
  }, { onConflict: "member_id" });
  if (error) throw new Error("Could not update reminder preferences.");
  revalidatePath("/tasks");
}

export async function savePerformanceAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const performanceId = value(form, "performance_id");
  const scheduleId = value(form, "content_schedule_id");
  if (performanceId && !z.string().uuid().safeParse(performanceId).success) throw new Error("Choose a valid performance record.");
  let targetScheduleId = scheduleId;
  let clientId: string | null = null;
  if (performanceId) {
    const { data: existing } = await ctx.supabase.from("performances").select("content_schedule_id,client_id").eq("id", performanceId).maybeSingle();
    if (!existing) throw new Error("This performance record is no longer available.");
    targetScheduleId = existing.content_schedule_id;
    clientId = existing.client_id;
  } else {
    if (!z.string().uuid().safeParse(scheduleId).success) throw new Error("Choose a valid publication schedule.");
    const { data: schedule } = await ctx.supabase.from("content_schedules").select("id,client_id,publication_status,published_at").eq("id", scheduleId).maybeSingle();
    if (!schedule || schedule.publication_status !== "published" || !schedule.published_at) throw new Error("Choose a publication that has been marked as published.");
    targetScheduleId = schedule.id;
    clientId = schedule.client_id;
  }
  const metric = (key: string) => {
    const raw = value(form, key);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${key} must be a non-negative whole number.`);
    return n;
  };
  const measuredAtValue=value(form,"measured_at");
  const measuredAtDate=measuredAtValue?new Date(`${measuredAtValue}:00+07:00`):null;
  if (measuredAtValue&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(measuredAtValue)||!measuredAtDate||Number.isNaN(measuredAtDate.getTime()))) throw new Error("Enter a valid measurement date and time.");
  const contentUrl = value(form, "content_url");
  if (contentUrl && !z.string().url().safeParse(contentUrl).success) throw new Error("Enter a valid published URL.");
  const record = {
    content_schedule_id: targetScheduleId, client_id: clientId,
    ...(measuredAtDate ? { measured_at: measuredAtDate.toISOString() } : performanceId ? {} : { measured_at: new Date().toISOString() }),
    measurement_label: value(form, "measurement_label") || "manual",
    reach: metric("reach"), impressions: metric("impressions"), views: metric("views"),
    likes: metric("likes"), comments: metric("comments"), shares: metric("shares"), saves: metric("saves"),
    content_url: contentUrl || null,
    evaluation_notes: value(form, "evaluation_notes") || null,
  };
  const { error } = performanceId
    ? await ctx.supabase.from("performances").update(record).eq("id", performanceId)
    : await ctx.supabase.from("performances").insert({ ...record, created_by: ctx.user.id });
  if (error) throw new Error("Could not save these performance measurements.");
  revalidatePath("/performance");
  redirect(performanceId ? `/performance/${performanceId}?saved=1` : "/performance?tab=performance&saved=1");
}

function validPeriod(form: FormData) {
  const start = value(form, "period_start");
  const end = value(form, "period_end");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) throw new Error("Choose a valid report period.");
  return { start, end };
}

export async function createMonthlyReportAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const clientId = value(form, "client_id");
  if (!z.string().uuid().safeParse(clientId).success) throw new Error("Choose a client for the report.");
  const { start, end } = validPeriod(form);
  const { data, error } = await ctx.supabase.from("monthly_reports").insert({
    client_id: clientId, period_start: start, period_end: end,
    work_summary: value(form,"work_summary"), evaluation: value(form,"evaluation"),
    challenges: value(form,"challenges"), next_plan: value(form,"next_plan"), created_by: ctx.user.id,
  }).select("id").single();
  if (error || !data) throw new Error("Could not create the monthly report draft.");
  revalidatePath("/performance"); revalidatePath("/reports");
  redirect(`/reports?tab=monthly&monthlyReport=${data.id}`);
}

export async function updateMonthlyReportAction(reportId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const { start, end } = validPeriod(form);
  const { error } = await ctx.supabase.from("monthly_reports").update({
    period_start: start, period_end: end,
    work_summary: value(form,"work_summary"), evaluation: value(form,"evaluation"),
    challenges: value(form,"challenges"), next_plan: value(form,"next_plan"),
  }).eq("id", reportId);
  if (error) throw new Error("Could not update this monthly report draft.");
  revalidatePath("/reports");
}

export async function finalizeMonthlyReportAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const id = value(form, "report_id");
  const { data: versionId, error } = await ctx.supabase.rpc("finalize_monthly_report", { p_report_id: id });
  if (error || !versionId) throw new Error("Could not finalize this report. Review its dates and client data.");
  revalidatePath("/reports");
  redirect(`/reports?tab=monthly&monthlyReport=${id}&version=${versionId}`);
}

export async function createSocialReportAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const clientId = value(form, "client_id");
  if (!z.string().uuid().safeParse(clientId).success) throw new Error("Choose a client for the report.");
  const { start, end } = validPeriod(form);
  const platform = value(form, "platform");
  if (!platform) throw new Error("Choose a platform.");
  const selected = [...new Set(form.getAll("performance_ids").filter((x): x is string => typeof x === "string" && z.string().uuid().safeParse(x).success))];
  if (selected.length) {
    const { data: performanceRows, error: performanceError } = await ctx.supabase.from("performances").select("id,client_id,content_schedule_id").in("id", selected);
    if (performanceError || performanceRows?.length !== selected.length || performanceRows.some(row => row.client_id !== clientId)) throw new Error("Selected performance records must belong to this client.");
    if (new Set((performanceRows ?? []).map(row => row.content_schedule_id)).size !== selected.length) throw new Error("Select one measurement snapshot per publication schedule.");
    const scheduleIds = performanceRows.map(row => row.content_schedule_id);
    const { data: scheduleRows } = await ctx.supabase.from("content_schedules").select("id,platform,publication_status,published_at").in("id", scheduleIds);
    const localDate = (timestamp: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
    if (!scheduleRows || scheduleRows.some(row => row.platform !== platform || row.publication_status !== "published" || !row.published_at || localDate(row.published_at) < start || localDate(row.published_at) > end)) throw new Error("Selected records must be published on the chosen platform within this period.");
  }
  const { data: report, error } = await ctx.supabase.from("social_reports").insert({
    client_id: clientId, platform, account_label: value(form,"account_label"), period_start: start, period_end: end,
    summary: value(form,"summary"), evaluation: value(form,"evaluation"), next_plan: value(form,"next_plan"), created_by: ctx.user.id,
  }).select("id").single();
  if (error || !report) throw new Error("Could not create the social report draft.");
  if (selected.length) {
    const scheduleByPerformance = new Map((await ctx.supabase.from("performances").select("id,content_schedule_id").in("id",selected)).data?.map(row=>[row.id,row.content_schedule_id]) ?? []);
    const { error: itemsError } = await ctx.supabase.from("social_report_items").insert(selected.map(performanceId => ({ social_report_id: report.id, client_id: clientId, performance_id: performanceId, content_schedule_id: scheduleByPerformance.get(performanceId) })));
    if (itemsError) {
      await ctx.supabase.from("social_reports").delete().eq("id", report.id);
      throw new Error("Could not link the selected performance snapshots to this report.");
    }
  }
  revalidatePath("/performance"); revalidatePath("/reports");
  redirect(`/reports?tab=social&socialReport=${report.id}`);
}

export async function updateSocialReportAction(reportId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const { start, end } = validPeriod(form);
  const { error } = await ctx.supabase.from("social_reports").update({
    period_start: start, period_end: end, account_label: value(form,"account_label"),
    summary: value(form,"summary"), evaluation: value(form,"evaluation"), next_plan: value(form,"next_plan"),
  }).eq("id", reportId);
  if (error) throw new Error("Could not update this social report draft.");
  revalidatePath("/reports");
}

export async function finalizeSocialReportAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const id = value(form, "report_id");
  const { data: versionId, error } = await ctx.supabase.rpc("finalize_social_report", { p_report_id: id });
  if (error || !versionId) throw new Error("Could not finalize this social report.");
  revalidatePath("/reports");
  redirect(`/reports?tab=social&socialReport=${id}&version=${versionId}`);
}

export async function queueReportPdfAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const reportType = value(form,"report_type");
  const versionId = value(form,"version_id");
  if (!["monthly","social"].includes(reportType) || !z.string().uuid().safeParse(versionId).success) throw new Error("Choose a finalized report version.");
  const sourceField = reportType === "monthly" ? "monthly_report_version_id" : "social_report_version_id";
  const { data: existing } = await ctx.supabase.from("report_pdf_jobs").select("id,status").eq(sourceField, versionId).maybeSingle();
  if (existing?.status === "queued" || existing?.status === "processing") redirect(`/reports?tab=${reportType === "monthly" ? "monthly" : "social"}&queued=1`);
  const result = existing
    ? await ctx.supabase.rpc("requeue_report_pdf_job", { p_job_id: existing.id })
    : await ctx.supabase.from("report_pdf_jobs").insert({ report_type: reportType, [sourceField]: versionId, created_by:ctx.user.id });
  if (result.error) throw new Error("Could not queue PDF generation.");
  revalidatePath("/reports");
  redirect(`/reports?tab=${reportType === "monthly" ? "monthly" : "social"}&queued=1`);
}
