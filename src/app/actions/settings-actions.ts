"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

const agencySchema = z.object({
  agency_name: z.string().trim().min(2).max(120),
  timezone: z.string().trim().min(1).max(80),
  currency: z.string().trim().length(3),
  date_format: z.string().trim().min(1).max(32),
});

export async function saveAgencySettingsAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) throw new Error("Sign in to save workspace settings.");
  const canManageWorkspace = ctx.access.permissions?.includes("workspace.manage")
    || ["owner", "admin"].includes(ctx.access.legacy_role ?? "");
  if (!canManageWorkspace) throw new Error("Only the workspace administrator can update agency settings.");
  const parsed = agencySchema.safeParse({
    agency_name: field(form, "agency_name"),
    timezone: field(form, "timezone"),
    currency: field(form, "currency"),
    date_format: field(form, "date_format"),
  });
  if (!parsed.success) throw new Error("Check the agency name and regional settings.");
  const { data: settings } = await ctx.supabase.from("agency_settings").select("id").eq("is_singleton", true).maybeSingle();
  const result = settings
    ? await ctx.supabase.from("agency_settings").update(parsed.data).eq("id", settings.id)
    : await ctx.supabase.from("agency_settings").insert({ is_singleton: true, ...parsed.data });
  if (result.error) throw new Error("Settings could not be saved. You may need agency administrator access.");
  revalidatePath("/settings");
  redirect("/settings?section=agency&saved=1");
}

const billingSchema = z.object({
  agency_name: z.string().trim().max(160), address: z.string().trim().max(1200),
  email: z.union([z.literal(""), z.string().trim().email().max(254)]), phone: z.string().trim().max(40),
  bank_name: z.string().trim().max(120), bank_account_number: z.string().trim().max(80),
  bank_account_holder: z.string().trim().max(160), authorized_signatory: z.string().trim().max(160),
  signatory_title: z.string().trim().max(120), default_payment_terms: z.string().trim().max(500),
});

export async function saveBillingProfileAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) throw new Error("Sign in to save billing settings.");
  const { data: access } = await ctx.supabase.from("agency_members").select("role").eq("id", ctx.user.id).maybeSingle();
  if (!access || !["owner", "admin"].includes(access.role)) throw new Error("Only agency administrators can update billing information.");
  const parsed = billingSchema.safeParse(Object.fromEntries([
    "agency_name", "address", "email", "phone", "bank_name", "bank_account_number",
    "bank_account_holder", "authorized_signatory", "signatory_title", "default_payment_terms",
  ].map(key => [key, field(form, key)])));
  if (!parsed.success) throw new Error("Check the billing information and try again.");
  const taxRate = z.coerce.number().finite().min(0).max(100).safeParse(field(form,"tax_rate_percent"));
  if (!taxRate.success) throw new Error("Tax rate must be between 0 and 100 percent.");
  const billingData={...parsed.data,tax_configuration:{enabled:form.get("tax_enabled")==="on",rate:taxRate.data/100}};
  const { data: profile } = await ctx.supabase.from("agency_billing_profiles").select("id").eq("is_singleton", true).maybeSingle();
  const result = profile
    ? await ctx.supabase.from("agency_billing_profiles").update(billingData).eq("id", profile.id)
    : await ctx.supabase.from("agency_billing_profiles").insert({ is_singleton: true, ...billingData, created_by: ctx.user.id });
  if (result.error) throw new Error("Billing information could not be saved. Check your access and try again.");
  revalidatePath("/settings");
  revalidatePath("/documents");
  redirect("/settings?section=billing&saved=1");
}

export async function saveTaskNotificationPreferenceAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) throw new Error("Sign in to save notification preferences.");
  const { error } = await ctx.supabase.from("task_notification_preferences").upsert({
    member_id: ctx.user.id,
    email_enabled: form.get("email_enabled") === "on",
    reminder_offsets_days: [3, 1, 0],
    reminder_time: "09:00",
    timezone: "Asia/Jakarta",
  }, { onConflict: "member_id" });
  if (error) throw new Error("Reminder preference could not be saved. Try again.");
  revalidatePath("/settings");
  revalidatePath("/tasks");
  redirect("/settings?section=notifications&saved=1");
}
