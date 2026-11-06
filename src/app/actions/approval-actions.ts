"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";

const uuid = z.string().uuid();
const text = (form: FormData, key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
const back = (id: string, message: string): never => redirect(`/approval/${id}?error=${encodeURIComponent(message)}`);

export async function submitContentForReviewAction(form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  const contentId = text(form, "content_id");
  const reviewerId = text(form, "reviewer_id");
  if (!uuid.safeParse(contentId).success || !uuid.safeParse(reviewerId).success) redirect("/approval?error=Choose%20content%20and%20reviewer.");
  const [{ data: content }, { data: reviewer }] = await Promise.all([
    ctx.supabase.from("contents").select("id,workflow_status").eq("id", contentId).is("deleted_at", null).maybeSingle(),
    ctx.supabase.from("agency_members").select("id").eq("id", reviewerId).eq("is_active", true).maybeSingle(),
  ]);
  if (!content || !reviewer) redirect("/approval?error=Content%20or%20reviewer%20is%20unavailable.");
  if (!["internal_review", "client_review", "review", "production", "in_production"].includes(content.workflow_status)) redirect("/approval?error=Move%20content%20to%20review%20before%20submitting.");
  const { data: existing } = await ctx.supabase.from("content_approvals").select("id").eq("content_id", contentId).eq("approval_status", "pending").maybeSingle();
  if (existing) redirect(`/approval/${existing.id}`);
  const { data, error } = await ctx.supabase.from("content_approvals").insert({ content_id: contentId, reviewer_id: reviewerId, created_by: ctx.user.id, approval_status: "pending" }).select("id").single();
  if (error || !data) redirect("/approval?error=Could%20not%20submit%20this%20content%20for%20review.");
  revalidatePath("/approval");
  revalidatePath(`/content/${contentId}`);
  redirect(`/approval/${data.id}`);
}

export async function reviewContentAction(approvalId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext();
  if (!ctx) redirect("/login");
  if (!uuid.safeParse(approvalId).success) redirect("/approval");
  const decision = text(form, "decision");
  const feedback = text(form, "feedback");
  if (!["approved", "revision_requested", "rejected"].includes(decision)) back(approvalId, "Pilih keputusan review yang valid.");
  if (decision !== "approved" && feedback.length < 3) back(approvalId, "Feedback wajib diisi untuk revisi atau penolakan.");
  if (feedback.length > 4000) back(approvalId, "Feedback maksimal 4.000 karakter.");

  const { data: approval, error: loadError } = await ctx.supabase.from("content_approvals").select("id,content_id,reviewer_id,approval_status").eq("id", approvalId).maybeSingle();
  if (loadError) back(approvalId, "Item approval tidak ditemukan.");
  if (!approval) back(approvalId, "Item approval tidak ditemukan.");
  const currentApproval = approval!;
  if (currentApproval.reviewer_id !== ctx.user.id) back(approvalId, "Hanya reviewer yang ditugaskan dapat memberi keputusan.");
  if (currentApproval.approval_status !== "pending") back(approvalId, "Item ini sudah direview.");

  const { error } = await ctx.supabase.rpc("review_content_approval", {
    p_approval_id: approvalId,
    p_decision: decision,
    p_feedback: feedback,
  });
  if (error) back(approvalId, "Keputusan dan perubahan workflow tidak tersimpan. Muat ulang dan coba lagi.");
  revalidatePath("/approval");
  revalidatePath(`/approval/${approvalId}`);
  revalidatePath(`/content/${currentApproval.content_id}`);
  redirect(`/approval/${approvalId}?saved=1`);
}
