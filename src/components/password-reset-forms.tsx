"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (requestError) throw requestError;
      setMessage("If an account matches that email, a password reset link will arrive shortly.");
    } catch {
      setError("Could not request a reset link. Check the Supabase redirect URL configuration and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="login-form" onSubmit={submit}>
    <label htmlFor="recovery-email">Email address</label>
    <input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@babeagency.com" />
    {!configured && <div className="setup-notice" role="status">Add the public Supabase URL and anon key to <code>.env.local</code> to enable password recovery.</div>}
    {error && <div className="form-error" role="alert">{error}</div>}
    {message && <div className="setup-notice" role="status">{message}</div>}
    <button className="button button-primary login-submit" type="submit" disabled={busy || !configured}>
      {busy ? "Sending link…" : "Send reset link"}
    </button>
    <div className="login-recovery-link"><Link href="/login">Back to sign in</Link></div>
  </form>;
}

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword("");
      setConfirmation("");
      setMessage("Your password has been updated. You can now sign in.");
    } catch {
      setError("This reset link is invalid or expired. Request a new link and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="login-form" onSubmit={submit}>
    <label htmlFor="new-password">New password</label>
    <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} />
    <label htmlFor="confirm-password">Confirm new password</label>
    <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} />
    {error && <div className="form-error" role="alert">{error}</div>}
    {message && <div className="setup-notice" role="status">{message} <Link href="/login">Sign in</Link></div>}
    {!message && <button className="button button-primary login-submit" type="submit" disabled={busy || !configured}>{busy ? "Updating password…" : "Update password"}</button>}
  </form>;
}
