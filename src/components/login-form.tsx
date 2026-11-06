"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      router.push("/workspace");
    } catch {
      setError("Unable to sign in. Check your email and password, then try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="login-form" onSubmit={submit}>
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
  </form>;
}
