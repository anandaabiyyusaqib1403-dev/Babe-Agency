"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

export function ChangePasswordForm({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (newPassword.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (reauthError) throw reauthError;
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setMessage("Password updated successfully.");
    } catch {
      setError("Could not update your password. Check your current password and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="settings-form settings-password-form" onSubmit={submit}>
    <label className="settings-field"><span>Current password</span><input type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label>
    <label className="settings-field"><span>New password</span><input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={event => setNewPassword(event.target.value)} /></label>
    <label className="settings-field"><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
    {error && <p className="settings-notice" role="alert">{error}</p>}
    {message && <p className="settings-notice settings-success" role="status">{message}</p>}
    {!configured && <p className="settings-notice" role="status">Password changes require a configured Supabase project.</p>}
    <button className="ui-button ui-button-primary" type="submit" disabled={busy || !configured}>{busy ? "Updating password…" : "Update password"}</button>
  </form>;
}
