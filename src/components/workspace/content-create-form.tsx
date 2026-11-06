"use client";

import { useMemo, useState } from "react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { createPlannerContent } from "@/app/actions/workspace-actions";

type Client = { id: string; brand_name: string };
type Pillar = { id: string; client_id: string; pillar_name: string };
type Assignment = { id: string; client_id: string; package_name_snapshot: string; start_date: string; end_date: string | null };
type Quota = { client_package_id: string; content_type: string; quota: number; used?: number };
type Member = { id: string; full_name: string };

export function ContentCreateForm({ clients, pillars, assignments, quotas, members }: { clients: Client[]; pillars: Pillar[]; assignments: Assignment[]; quotas: Quota[]; members: Member[] }) {
  const [clientId, setClientId] = useState("");
  const selectedPillars = useMemo(() => pillars.filter(row => row.client_id === clientId), [pillars, clientId]);
  const assignment = assignments.find(row => row.client_id === clientId);
  const assignmentQuotas = quotas.filter(row => row.client_package_id === assignment?.id);
  return <form action={createPlannerContent} className="workspace-form content-create-form">
    <label>Client <span aria-hidden="true">*</span><Select name="client_id" required value={clientId} onChange={event => setClientId(event.target.value)}><option value="">Pilih client</option>{clients.map(row => <option key={row.id} value={row.id}>{row.brand_name}</option>)}</Select></label>
    <label>Content title <span aria-hidden="true">*</span><Input name="title" required minLength={2} maxLength={160} /></label>
    <label>Content type <span aria-hidden="true">*</span><Input name="content_type" list="content-type-list" required maxLength={80} placeholder="Reels, Carousel, Single Feed…" /><datalist id="content-type-list">{[...new Set(quotas.map(q => q.content_type)), "Reels", "Carousel", "Single Feed", "Story"].map(type => <option key={type} value={type} />)}</datalist></label>
    <label>Platform <span aria-hidden="true">*</span><Input name="platform" list="platform-list" required maxLength={80} placeholder="Instagram, TikTok…" /><datalist id="platform-list">{["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn"].map(platform => <option key={platform} value={platform} />)}</datalist></label>
    <label>Content pillar<Select name="pillar_id" defaultValue=""><option value="">Tanpa pillar</option>{selectedPillars.map(p => <option key={p.id} value={p.id}>{p.pillar_name}</option>)}</Select></label>
    <label>Objective<Input name="objective" maxLength={250} /></label>
    <label>Campaign<Input name="campaign" maxLength={160} /></label>
    <label>Person in charge<Select name="assigned_to" defaultValue=""><option value="">Belum ditentukan</option>{members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}</Select></label>
    <label>Initial status<Select name="workflow_status" defaultValue="idea">{[["idea", "Idea"], ["brief", "Brief"], ["in_production", "Production"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></label>
    <label>Content description<Textarea name="content_description" rows={3} maxLength={4000} /></label>
    <label>Key message<Textarea name="key_message" rows={3} maxLength={2000} /></label>
    <label>Caption<Textarea name="caption" rows={3} maxLength={4000} /></label>
    <label>Production notes<Textarea name="production_notes" rows={3} maxLength={2000} /></label>
    <label>First publication date and time (optional)<Input type="datetime-local" name="scheduled_at" /></label>
    {clientId && <div className="content-quota-hint"><strong>{assignment ? `Paket aktif: ${assignment.package_name_snapshot}` : "Paket aktif belum diatur"}</strong>{assignment ? <ul>{assignmentQuotas.length ? assignmentQuotas.map(q => <li key={q.content_type}>{q.content_type}: {q.used ?? 0} / {q.quota}</li>) : <li>Kuota belum ditetapkan</li>}</ul> : <p>Konten tetap dapat dibuat tanpa assignment paket.</p>}</div>}
    <div className="form-actions"><Button type="submit" variant="primary">Create content</Button></div>
  </form>;
}
