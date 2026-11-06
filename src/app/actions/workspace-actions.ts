"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActiveWorkspaceContext } from "@/lib/workspace-access";

const uuid = z.string().uuid();
const text = (form: FormData, key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
function fail(to: string, message: string): never { redirect(`${to}${to.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`); }
function saved(to: string): never { redirect(`${to}${to.includes("?") ? "&" : "?"}saved=1`); }
const statusList = ["lead", "active", "inactive", "archived"] as const;
const contentStatusList = ["idea", "brief", "in_production", "internal_review", "client_review", "revision", "approved", "completed", "published", "cancelled"] as const;

function revalidateWorkspace(clientId?: string, contentId?: string) {
  revalidatePath("/clients"); revalidatePath("/content"); revalidatePath("/dashboard");
  if (clientId) revalidatePath(`/clients/${clientId}`);
  if (contentId) revalidatePath(`/content/${contentId}`);
}

export async function createWorkspaceClient(form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const data = z.object({ client_name: z.string().trim().min(2).max(120), brand_name: z.string().trim().min(2).max(120), contact_person: z.string().trim().max(120), email: z.union([z.literal(""), z.string().email().max(254)]), phone: z.string().trim().max(40), address: z.string().trim().max(500), industry: z.string().trim().max(100), status: z.enum(statusList), notes: z.string().trim().max(4000) }).safeParse(Object.fromEntries(["client_name", "brand_name", "contact_person", "email", "phone", "address", "industry", "status", "notes"].map(key => [key, text(form, key)])));
  if (!data.success) fail("/clients", "Periksa nama client dan format email.");
  const phone = data.data.phone.replace(/[\s().-]/g, "");
  if (phone && !/^\+?[0-9]{7,15}$/.test(phone)) fail("/clients", "Nomor telepon harus berisi 7–15 digit dan boleh diawali +.");
  const { data: client, error } = await ctx.supabase.from("clients").insert({ ...data.data, phone: phone || null, created_by: ctx.user.id }).select("id").single();
  if (error || !client) fail("/clients", "Client tidak dapat disimpan. Periksa data dan coba lagi.");
  revalidateWorkspace(client.id); redirect(`/clients/${client.id}?saved=1`);
}

export async function updateWorkspaceClient(clientId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  if (!uuid.safeParse(clientId).success) fail("/clients", "Client tidak valid.");
  const data = z.object({ client_name: z.string().trim().min(2).max(120), brand_name: z.string().trim().min(2).max(120), contact_person: z.string().trim().max(120), email: z.union([z.literal(""), z.string().email().max(254)]), phone: z.string().trim().max(40), address: z.string().trim().max(500), industry: z.string().trim().max(100), status: z.enum(statusList), notes: z.string().trim().max(4000) }).safeParse(Object.fromEntries(["client_name", "brand_name", "contact_person", "email", "phone", "address", "industry", "status", "notes"].map(key => [key, text(form, key)])));
  if (!data.success) fail(`/clients/${clientId}/edit`, "Periksa nama client dan format email.");
  const phone = data.data.phone.replace(/[\s().-]/g, "");
  if (phone && !/^\+?[0-9]{7,15}$/.test(phone)) fail(`/clients/${clientId}/edit`, "Nomor telepon harus berisi 7–15 digit dan boleh diawali +.");
  const { error } = await ctx.supabase.from("clients").update({ ...data.data, phone: phone || null }).eq("id", clientId).is("deleted_at", null);
  if (error) fail(`/clients/${clientId}/edit`, "Perubahan client gagal disimpan.");
  revalidateWorkspace(clientId); saved(`/clients/${clientId}`);
}

export async function archiveWorkspaceClient(clientId: string) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  if (!uuid.safeParse(clientId).success) fail("/clients", "Client tidak valid.");
  const { error } = await ctx.supabase.from("clients").update({ status: "archived" }).eq("id", clientId).is("deleted_at", null);
  if (error) fail("/clients", "Client tidak dapat diarsipkan.");
  revalidateWorkspace(clientId); saved("/clients");
}

const briefFields = ["business_background", "brand_description", "business_objectives", "marketing_objectives", "target_audience", "customer_persona", "customer_needs", "brand_positioning", "market_position", "brand_personality", "brand_voice", "communication_style", "differentiation", "competitors", "visual_references", "existing_social_media", "website_links", "marketing_notes", "special_requirements", "additional_notes"] as const;
export async function saveClientBrief(clientId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  if (!uuid.safeParse(clientId).success) fail("/clients", "Client tidak valid.");
  const all = Object.fromEntries(briefFields.map(key => [key, text(form, key)]));
  const current = await ctx.supabase.from("client_briefs").select("id").eq("client_id", clientId).maybeSingle();
  if (current.error) fail(`/clients/${clientId}?tab=brief`, "Brief client tidak dapat dimuat.");
  const competitors = all.competitors.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const references = [...all.visual_references.split(/\r?\n/), ...all.existing_social_media.split(/\r?\n/), ...all.website_links.split(/\r?\n/)].map(x => x.trim()).filter(Boolean);
  const data = { business_background: all.business_background, brand_description: all.brand_description, business_objectives: all.business_objectives, marketing_objectives: all.marketing_objectives, customer_persona: all.customer_persona, customer_needs: all.customer_needs, brand_voice: all.brand_voice, market_position: all.market_position, differentiation: all.differentiation, visual_references: all.visual_references, existing_social_media: all.existing_social_media, website_links: all.website_links, marketing_notes: all.marketing_notes, special_requirements: all.special_requirements, additional_notes: all.additional_notes, objectives: all.marketing_objectives || all.business_objectives, target_audience: all.target_audience, brand_personality: all.brand_personality, brand_positioning: all.brand_positioning, visual_direction: all.visual_references, communication_style: all.communication_style, competitors, references_data: references, additional_information: all.additional_notes };
  const result = current.data ? await ctx.supabase.from("client_briefs").update(data).eq("client_id", clientId) : await ctx.supabase.from("client_briefs").insert({ ...data, client_id: clientId, created_by: ctx.user.id });
  if (result.error) fail(`/clients/${clientId}?tab=brief`, "Brief gagal disimpan.");
  revalidateWorkspace(clientId); saved(`/clients/${clientId}?tab=brief`);
}

export async function assignClientPackage(clientId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const packageId = text(form, "package_id"), start = text(form, "start_date"), end = text(form, "end_date"), rawPrice = text(form, "price");
  if (!uuid.safeParse(clientId).success || !uuid.safeParse(packageId).success || !/^\d{4}-\d{2}-\d{2}$/.test(start) || (end && (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start))) fail(`/clients/${clientId}?tab=packages`, "Pilih paket dan periode layanan yang valid.");
  const price = Number(rawPrice); if (!Number.isFinite(price) || price < 0) fail(`/clients/${clientId}?tab=packages`, "Harga harus berupa angka nol atau lebih.");
  const { data: pkg, error: pkgError } = await ctx.supabase.from("packages").select("id,package_name,description,base_price").eq("id", packageId).eq("status", "active").maybeSingle();
  if (pkgError || !pkg) fail(`/clients/${clientId}?tab=packages`, "Paket tidak tersedia.");
  const active = await ctx.supabase.from("client_packages").select("id").eq("client_id", clientId).eq("status", "active").limit(1).maybeSingle();
  if (active.data) fail(`/clients/${clientId}?tab=packages`, "Akhiri assignment aktif sebelum menambahkan paket baru.");
  const { data: assignment, error } = await ctx.supabase.from("client_packages").insert({ client_id: clientId, package_id: packageId, start_date: start, end_date: end || null, package_name_snapshot: pkg.package_name, package_description_snapshot: pkg.description, package_price_snapshot: price, created_by: ctx.user.id, status: "active" }).select("id").single();
  if (error || !assignment) fail(`/clients/${clientId}?tab=packages`, "Assignment paket gagal disimpan.");
  const quotas = await ctx.supabase.from("package_content_quotas").select("content_type,quota").eq("package_id", packageId);
  if (quotas.error) fail(`/clients/${clientId}?tab=packages`, "Paket tersimpan, tetapi kuota default tidak dapat dimuat.");
  if (quotas.data?.length) {
    const { error: quotaError } = await ctx.supabase.from("client_package_quotas").insert(quotas.data.map(row => ({ client_package_id: assignment.id, content_type: row.content_type, quota: row.quota })));
    if (quotaError) fail(`/clients/${clientId}?tab=packages`, "Paket tersimpan, tetapi kuota perlu diatur ulang.");
  }
  revalidateWorkspace(clientId); saved(`/clients/${clientId}?tab=packages`);
}

export async function updateClientPackage(clientId: string, assignmentId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const start = text(form, "start_date"), end = text(form, "end_date"), price = Number(text(form, "price"));
  if (!uuid.safeParse(clientId).success || !uuid.safeParse(assignmentId).success || !/^\d{4}-\d{2}-\d{2}$/.test(start) || (end && end < start) || !Number.isFinite(price) || price < 0) fail(`/clients/${clientId}?tab=packages`, "Periode atau harga tidak valid.");
  const invoice = await ctx.supabase.from("invoices").select("id").eq("client_package_id", assignmentId).limit(1).maybeSingle();
  if (invoice.data) fail(`/clients/${clientId}?tab=packages`, "Assignment dengan invoice terkait tidak dapat mengubah snapshot harga.");
  const { error } = await ctx.supabase.from("client_packages").update({ start_date: start, end_date: end || null, package_price_snapshot: price }).eq("id", assignmentId).eq("client_id", clientId).eq("status", "active");
  if (error) fail(`/clients/${clientId}?tab=packages`, "Assignment paket gagal diperbarui.");
  const quotas = form.getAll("quota").filter((x): x is string => typeof x === "string");
  const types = form.getAll("content_type").filter((x): x is string => typeof x === "string");
  if (quotas.length !== types.length || quotas.some(x => !/^\d+$/.test(x))) fail(`/clients/${clientId}?tab=packages`, "Kuota harus berupa bilangan bulat nol atau lebih.");
  const existing = await ctx.supabase.from("client_package_quotas").select("id,content_type").eq("client_package_id", assignmentId);
  if (existing.error) fail(`/clients/${clientId}?tab=packages`, "Kuota tidak dapat diperbarui.");
  for (const row of existing.data ?? []) if (!types.includes(row.content_type)) await ctx.supabase.from("client_package_quotas").delete().eq("id", row.id);
  for (let i = 0; i < types.length; i++) {
    const type = types[i].trim(); if (!type) continue;
    const { error: quotaError } = await ctx.supabase.from("client_package_quotas").upsert({ client_package_id: assignmentId, content_type: type, quota: Number(quotas[i]) }, { onConflict: "client_package_id,content_type" });
    if (quotaError) fail(`/clients/${clientId}?tab=packages`, "Kuota gagal diperbarui.");
  }
  revalidateWorkspace(clientId); saved(`/clients/${clientId}?tab=packages`);
}

export async function archiveClientPackage(clientId: string, assignmentId: string) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const { error } = await ctx.supabase.from("client_packages").update({ status: "cancelled" }).eq("id", assignmentId).eq("client_id", clientId).eq("status", "active");
  if (error) fail(`/clients/${clientId}?tab=packages`, "Assignment paket tidak dapat diarsipkan.");
  revalidateWorkspace(clientId); saved(`/clients/${clientId}?tab=packages`);
}

export async function saveClientPillar(clientId: string, pillarId: string | null, form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const name = text(form, "pillar_name"), description = text(form, "description");
  const extras = JSON.stringify({ objective: text(form, "objective"), target_audience: text(form, "target_audience"), direction: text(form, "direction"), example_topics: text(form, "example_topics").split(/\r?\n/).map(x => x.trim()).filter(Boolean) });
  if (!uuid.safeParse(clientId).success || name.length < 2 || name.length > 120 || description.length > 2000) fail(`/clients/${clientId}?tab=strategy`, "Nama pillar wajib diisi dan panjangnya maksimal 120 karakter.");
  const info = JSON.parse(extras) as { objective: string; target_audience: string; direction: string; example_topics: string[] };
  const payload = { client_id: clientId, pillar_name: name, description, objective: info.objective, target_audience: info.target_audience, content_direction: info.direction, example_topics: info.example_topics, status: "active" };
  const result = pillarId ? await ctx.supabase.from("content_pillars").update(payload).eq("id", pillarId).eq("client_id", clientId) : await ctx.supabase.from("content_pillars").insert({ ...payload, created_by: ctx.user.id });
  if (result.error) fail(`/clients/${clientId}?tab=strategy`, "Content pillar gagal disimpan.");
  revalidateWorkspace(clientId); saved(`/clients/${clientId}?tab=strategy`);
}

export async function archiveClientPillar(clientId: string, pillarId: string) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const { error } = await ctx.supabase.from("content_pillars").update({ status: "archived" }).eq("id", pillarId).eq("client_id", clientId);
  if (error) fail(`/clients/${clientId}?tab=strategy`, "Pillar tidak dapat diarsipkan.");
  revalidateWorkspace(clientId); saved(`/clients/${clientId}?tab=strategy`);
}

export async function createPlannerContent(form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const clientId = text(form, "client_id"), pillarId = text(form, "pillar_id"), title = text(form, "title"), type = text(form, "content_type"), platform = text(form, "platform"), status = text(form, "workflow_status");
  if (!uuid.safeParse(clientId).success || (pillarId && !uuid.safeParse(pillarId).success) || title.length < 2 || title.length > 160 || !type || type.length > 80 || !platform || platform.length > 80 || !contentStatusList.includes(status as typeof contentStatusList[number])) fail("/content", "Lengkapi client, judul, tipe, platform, dan status konten.");
  if (pillarId) { const pillar = await ctx.supabase.from("content_pillars").select("id").eq("id", pillarId).eq("client_id", clientId).eq("status", "active").maybeSingle(); if (!pillar.data) fail("/content", "Pillar harus berasal dari client yang dipilih."); }
  const assignedTo = text(form, "assigned_to");
  if (assignedTo) { const member = await ctx.supabase.from("agency_members").select("id").eq("id", assignedTo).eq("is_active", true).maybeSingle(); if (!member.data) fail("/content", "PIC harus merupakan anggota workspace yang aktif."); }
  const { data: assignment } = await ctx.supabase.from("client_packages").select("id").eq("client_id", clientId).eq("status", "active").order("start_date", { ascending: false }).limit(1).maybeSingle();
  const contentDescription = text(form, "content_description"), keyMessage = text(form, "key_message"), campaign = text(form, "campaign"), productionNotes = text(form, "production_notes");
  if ([contentDescription, keyMessage, campaign, productionNotes].some(value => value.length > 4000)) fail("/content", "Detail konten terlalu panjang.");
  const { data: content, error } = await ctx.supabase.from("contents").insert({ client_id: clientId, title, content_type: type, platform, pillar_id: pillarId || null, client_package_id: assignment?.id ?? null, objective: text(form, "objective") || null, brief: contentDescription || null, content_description: contentDescription, campaign, key_message: keyMessage, production_notes: productionNotes, assigned_to: assignedTo || null, caption: text(form, "caption") || null, workflow_status: status, created_by: ctx.user.id }).select("id").single();
  if (error || !content) fail("/content", "Konten gagal dibuat.");
  const scheduledAt = text(form, "scheduled_at");
  if (scheduledAt) {
    const parsed = parseLocalDateTime(scheduledAt); if (!parsed) fail(`/content/${content.id}`, "Jadwal publikasi tidak valid.");
    const { error: scheduleError } = await ctx.supabase.from("content_schedules").insert({ content_id: content.id, client_id: clientId, platform, scheduled_at: parsed });
    if (scheduleError) fail(`/content/${content.id}`, "Konten dibuat, tetapi jadwal publikasinya gagal disimpan.");
  }
  revalidateWorkspace(clientId, content.id); redirect(`/content/${content.id}?saved=1`);
}

export async function updatePlannerContent(contentId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  if (!uuid.safeParse(contentId).success) fail("/content", "Konten tidak valid.");
  const status = text(form, "workflow_status");
  const { data: current } = await ctx.supabase.from("contents").select("id,client_id,workflow_status,pillar_id,client_package_id").eq("id", contentId).maybeSingle();
  if (!current) fail("/content", "Konten tidak ditemukan.");
  const transitions: Record<string, string[]> = { idea: ["brief", "in_production", "cancelled"], brief: ["idea", "in_production", "cancelled"], planned: ["idea", "brief", "in_production", "cancelled"], in_production: ["internal_review", "revision", "cancelled"], production: ["internal_review", "revision", "cancelled"], internal_review: ["client_review", "revision", "cancelled"], review: ["client_review", "revision", "cancelled"], client_review: ["approved", "revision", "cancelled"], revision: ["in_production", "internal_review", "cancelled"], approved: ["completed", "published", "cancelled"], completed: ["published", "cancelled"], published: [], cancelled: ["idea"] };
  if (status !== current.workflow_status && !transitions[current.workflow_status]?.includes(status)) fail(`/content/${contentId}`, "Transisi status konten tersebut tidak diizinkan.");
  const title = text(form, "title"), type = text(form, "content_type"), platform = text(form, "platform"), pillarId = text(form, "pillar_id");
  if (title.length < 2 || title.length > 160 || !type || !platform) fail(`/content/${contentId}`, "Periksa judul, tipe, dan platform.");
  if (pillarId) { const pillar = await ctx.supabase.from("content_pillars").select("id").eq("id", pillarId).eq("client_id", current.client_id).eq("status", "active").maybeSingle(); if (!pillar.data) fail(`/content/${contentId}`, "Pillar harus berasal dari client konten ini."); }
  const assignedTo = text(form, "assigned_to");
  if (assignedTo) { const member = await ctx.supabase.from("agency_members").select("id").eq("id", assignedTo).eq("is_active", true).maybeSingle(); if (!member.data) fail(`/content/${contentId}`, "PIC harus merupakan anggota workspace yang aktif."); }
  const contentDescription = text(form, "content_description"), keyMessage = text(form, "key_message"), campaign = text(form, "campaign"), productionNotes = text(form, "production_notes");
  const { error } = await ctx.supabase.from("contents").update({ title, content_type: type, platform, pillar_id: pillarId || null, objective: text(form, "objective") || null, brief: contentDescription || null, content_description: contentDescription, campaign, key_message: keyMessage, production_notes: productionNotes, assigned_to: assignedTo || null, caption: text(form, "caption") || null, workflow_status: status }).eq("id", contentId);
  if (error) fail(`/content/${contentId}`, "Konten gagal diperbarui.");
  revalidateWorkspace(current.client_id, contentId); saved(`/content/${contentId}`);
}

export async function saveCreativeBrief(contentId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const current = await ctx.supabase.from("contents").select("id").eq("id", contentId).maybeSingle(); if (!current.data) fail("/content", "Konten tidak ditemukan.");
  const visual = text(form, "visual_reference").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (visual.some(url => !z.string().url().safeParse(url).success)) fail(`/content/${contentId}?tab=creative`, "Setiap referensi visual harus berupa URL yang valid.");
  const payload = { concept: text(form, "concept"), creative_direction: text(form, "creative_direction"), key_message: text(form, "key_message"), visual_reference: visual, target_audience: text(form, "target_audience"), hook: text(form, "hook"), caption_direction: text(form, "caption_direction"), call_to_action: text(form, "cta"), production_notes: text(form, "production_notes") };
  const existing = await ctx.supabase.from("content_creative_briefs").select("id").eq("content_id", contentId).maybeSingle();
  const result = existing.data ? await ctx.supabase.from("content_creative_briefs").update(payload).eq("content_id", contentId) : await ctx.supabase.from("content_creative_briefs").insert({ ...payload, content_id: contentId, created_by: ctx.user.id });
  if (result.error) fail(`/content/${contentId}?tab=creative`, "Creative brief gagal disimpan.");
  revalidateWorkspace(undefined, contentId); saved(`/content/${contentId}?tab=creative`);
}

export async function addStoryboard(contentId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const title = text(form, "storyboard_title") || "Storyboard";
  const { data: existing } = await ctx.supabase.from("content_storyboards").select("id").eq("content_id", contentId).limit(1).maybeSingle();
  let storyboardId = existing?.id;
  if (!storyboardId) { const result = await ctx.supabase.from("content_storyboards").insert({ content_id: contentId, title, created_by: ctx.user.id }).select("id").single(); if (result.error || !result.data) fail(`/content/${contentId}?tab=storyboard`, "Storyboard gagal dibuat."); storyboardId = result.data.id; }
  const { data: rows } = await ctx.supabase.from("content_storyboard_rows").select("sequence_no").eq("storyboard_id", storyboardId).order("sequence_no", { ascending: false }).limit(1);
  const rawDuration = text(form, "duration_seconds"); const duration = rawDuration ? Number(rawDuration) : null;
  if (duration !== null && (!Number.isFinite(duration) || duration <= 0)) fail(`/content/${contentId}?tab=storyboard`, "Durasi harus lebih besar dari nol.");
  const { error } = await ctx.supabase.from("content_storyboard_rows").insert({ storyboard_id: storyboardId, sequence_no: (rows?.[0]?.sequence_no ?? -1) + 1, scene: text(form, "scene"), visual_description: text(form, "visual_description"), shot_type: text(form, "shot_type"), camera_movement: text(form, "camera_movement"), audio: text(form, "audio"), dialogue: text(form, "dialogue"), duration_seconds: duration, notes: text(form, "notes") });
  if (error) fail(`/content/${contentId}?tab=storyboard`, "Baris storyboard gagal disimpan.");
  revalidateWorkspace(undefined, contentId); saved(`/content/${contentId}?tab=storyboard`);
}

export async function updateStoryboardRow(contentId: string, rowId: string, storyboardId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const rawDuration = text(form, "duration_seconds"), duration = rawDuration ? Number(rawDuration) : null;
  if (duration !== null && (!Number.isFinite(duration) || duration <= 0)) fail(`/content/${contentId}?tab=storyboard`, "Durasi harus lebih besar dari nol.");
  const { error } = await ctx.supabase.from("content_storyboard_rows").update({ scene: text(form, "scene"), visual_description: text(form, "visual_description"), shot_type: text(form, "shot_type"), camera_movement: text(form, "camera_movement"), audio: text(form, "audio"), dialogue: text(form, "dialogue"), duration_seconds: duration, notes: text(form, "notes") }).eq("id", rowId).eq("storyboard_id", storyboardId);
  if (error) fail(`/content/${contentId}?tab=storyboard`, "Baris storyboard gagal diperbarui.");
  revalidateWorkspace(undefined, contentId); saved(`/content/${contentId}?tab=storyboard`);
}

export async function deleteStoryboardRow(contentId: string, rowId: string, storyboardId: string) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const { error } = await ctx.supabase.from("content_storyboard_rows").delete().eq("id", rowId).eq("storyboard_id", storyboardId);
  if (error) fail(`/content/${contentId}?tab=storyboard`, "Baris storyboard gagal dihapus.");
  revalidateWorkspace(undefined, contentId); saved(`/content/${contentId}?tab=storyboard`);
}

export async function moveStoryboardRow(contentId: string, storyboardId: string, rowId: string, direction: "up" | "down") {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const { data: rows, error } = await ctx.supabase.from("content_storyboard_rows").select("id,sequence_no").eq("storyboard_id", storyboardId).order("sequence_no");
  if (error || !rows) fail(`/content/${contentId}?tab=storyboard`, "Urutan storyboard gagal dimuat.");
  const index = rows.findIndex(row => row.id === rowId), next = index + (direction === "up" ? -1 : 1);
  if (index < 0 || next < 0 || next >= rows.length) saved(`/content/${contentId}?tab=storyboard`);
  const order = rows.map(row => row.id); [order[index], order[next]] = [order[next], order[index]];
  for (const [sequence, id] of order.entries()) { const { error: updateError } = await ctx.supabase.from("content_storyboard_rows").update({ sequence_no: 10000 + sequence }).eq("id", id); if (updateError) fail(`/content/${contentId}?tab=storyboard`, "Urutan storyboard gagal diperbarui."); }
  for (const [sequence, id] of order.entries()) { const { error: updateError } = await ctx.supabase.from("content_storyboard_rows").update({ sequence_no: sequence }).eq("id", id); if (updateError) fail(`/content/${contentId}?tab=storyboard`, "Urutan storyboard gagal diperbarui."); }
  revalidateWorkspace(undefined, contentId); saved(`/content/${contentId}?tab=storyboard`);
}

export async function addContentSchedule(contentId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const { data: content } = await ctx.supabase.from("contents").select("id,client_id").eq("id", contentId).maybeSingle(); if (!content) fail("/content", "Konten tidak ditemukan.");
  const platform = text(form, "platform"), scheduled = parseLocalDateTime(text(form, "scheduled_at"));
  if (!platform || platform.length > 80 || !scheduled) fail(`/content/${contentId}?tab=schedules`, "Platform dan tanggal publikasi wajib diisi dengan format valid.");
  const { error } = await ctx.supabase.from("content_schedules").insert({ content_id: contentId, client_id: content.client_id, platform, scheduled_at: scheduled });
  if (error) fail(`/content/${contentId}?tab=schedules`, "Jadwal publikasi gagal dibuat.");
  revalidateWorkspace(content.client_id, contentId); saved(`/content/${contentId}?tab=schedules`);
}

export async function updateContentSchedule(contentId: string, scheduleId: string, form: FormData) {
  const ctx = await getActiveWorkspaceContext(); if (!ctx) redirect("/login");
  const platform = text(form, "platform"), status = text(form, "publication_status"), scheduled = parseLocalDateTime(text(form, "scheduled_at")), url = text(form, "post_url");
  if (!platform || !["scheduled", "published", "cancelled"].includes(status) || (text(form, "scheduled_at") && !scheduled) || (url && !z.string().url().safeParse(url).success)) fail(`/content/${contentId}?tab=schedules`, "Periksa platform, jadwal, status, dan URL publikasi.");
  const { data: existing } = await ctx.supabase.from("content_schedules").select("published_at").eq("id", scheduleId).eq("content_id", contentId).maybeSingle();
  const publishedAt = status !== "published" ? null : existing?.published_at ?? new Date().toISOString();
  const { error } = await ctx.supabase.from("content_schedules").update({ platform, scheduled_at: scheduled, publication_status: status, published_at: publishedAt, post_url: url || null }).eq("id", scheduleId).eq("content_id", contentId);
  if (error) fail(`/content/${contentId}?tab=schedules`, "Jadwal publikasi gagal diperbarui.");
  revalidateWorkspace(undefined, contentId); saved(`/content/${contentId}?tab=schedules`);
}

function parseLocalDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+07:00`); return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
