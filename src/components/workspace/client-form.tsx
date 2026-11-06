import type { ReactNode } from "react";
import { Button, Input, Select, Textarea } from "@/components/ui";

type Client = { client_name?: string | null; brand_name?: string; contact_person?: string | null; email?: string | null; phone?: string | null; address?: string | null; industry?: string | null; notes?: string | null; status?: string };
export function ClientForm({ action, client, submitLabel = "Save Client" }: { action: (form: FormData) => Promise<void>; client?: Client; submitLabel?: string }) {
  return <form action={action} className="workspace-form client-form">
    <fieldset><legend>Basic information</legend><label>Client name <span aria-hidden="true">*</span><Input name="client_name" required minLength={2} maxLength={120} defaultValue={client?.client_name ?? ""} /></label><label>Brand name <span aria-hidden="true">*</span><Input name="brand_name" required minLength={2} maxLength={120} defaultValue={client?.brand_name ?? ""} /></label><label>Industry<Input name="industry" maxLength={100} defaultValue={client?.industry ?? ""} /></label><label>Client status<Select name="status" defaultValue={client?.status ?? "lead"}>{["lead", "active", "inactive", "archived"].map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</Select></label></fieldset>
    <fieldset><legend>Contact information</legend><label>Contact person<Input name="contact_person" maxLength={120} defaultValue={client?.contact_person ?? ""} /></label><label>Email<Input type="email" name="email" maxLength={254} defaultValue={client?.email ?? ""} /></label><label>Phone number<Input type="tel" name="phone" inputMode="tel" pattern="\+?[0-9\s().-]{7,24}" title="Gunakan 7-15 digit, boleh diawali +" defaultValue={client?.phone ?? ""} /></label><label>Address<Input name="address" maxLength={500} defaultValue={client?.address ?? ""} /></label></fieldset>
    <label className="field-wide">Notes<Textarea name="notes" maxLength={4000} rows={4} defaultValue={client?.notes ?? ""} /></label>
    <div className="form-actions"><Button type="submit" variant="primary">{submitLabel}</Button></div>
  </form>;
}

export function Feedback({ saved, error }: { saved?: string | string[]; error?: string | string[] }) {
  if (!saved && !error) return null;
  const message: ReactNode = error ? String(error) : "Perubahan berhasil disimpan.";
  return <p className={`workspace-feedback${error ? " workspace-feedback-error" : ""}`} role="status">{message}</p>;
}
