"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

type LoginMode = "choose" | "sign-in" | "activate";

export function LoginForm() {
  const router = useRouter();
  const emailInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<LoginMode>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  function continueToSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMode("sign-in");
  }

  function showActivation() {
    if (!emailInput.current?.reportValidity()) return;
    setError(null);
    setMode("activate");
  }

  async function submitSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      router.push("/workspace");
    } catch {
      setError("Unable to sign in. Check your details, or activate your account from the invitation email.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "activate") {
    return <div className="login-form">
      <div className="activation-guidance" role="status">
        <strong>Use your invitation email</strong>
        <p>We don’t ask for a password here. Open the secure invitation link sent to <strong>{email}</strong> to verify your email and create your password.</p>
        <p>If you can’t find the invitation, contact your workspace administrator to confirm access or resend it.</p>
      </div>
      <button className="login-back-button" type="button" onClick={() => setMode("choose")}>Back</button>
    </div>;
  }

  if (mode === "sign-in") {
    return <form className="login-form" onSubmit={submitSignIn}>
      <label htmlFor="email">Email address</label>
      <input id="email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@babeagency.com" />
      <label htmlFor="password">Password</label>
      <input id="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" />
      <div className="login-recovery-link"><Link href="/auth/forgot-password">Forgot password?</Link></div>
      {!configured && <div className="setup-notice" role="status">Authentication needs a Supabase project. Add the public Supabase URL and anon key to <code>.env.local</code> to enable sign in.</div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="button button-primary login-submit" type="submit" disabled={busy || !configured}>
        {busy ? "Signing in…" : "Sign in to workspace"}
      </button>
      <button className="login-back-button" type="button" onClick={() => { setPassword(""); setError(null); setMode("choose"); }}>Use another option</button>
    </form>;
  }

  return <form className="login-form" onSubmit={continueToSignIn}>
    <label htmlFor="email">Email address</label>
    <input ref={emailInput} id="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@babeagency.com" />
    {!configured && <div className="setup-notice" role="status">Authentication needs a Supabase project. Add the public Supabase URL and anon key to <code>.env.local</code> to enable sign in.</div>}
    <button className="button button-primary login-submit" type="submit">Continue to sign in</button>
    <button className="login-back-button" type="button" onClick={showActivation}>First time? Activate with an invitation</button>
  </form>;
}
