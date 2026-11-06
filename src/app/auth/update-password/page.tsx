import type { Metadata } from "next";
import Link from "next/link";
import { UpdatePasswordForm } from "@/components/password-reset-forms";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Create your password" };

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ flow?: string; link?: string }> }) {
  const params = await searchParams;
  const flow = params.flow === "invite" ? "invite" : "recovery";
  let hasVerifiedSession = false;
  if (!params.link && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    hasVerifiedSession = Boolean(user);
  }
  const invalidLink = params.link === "invalid" || !hasVerifiedSession;
  return <main className="login-page">
    <section className="login-card" aria-labelledby="update-password-title">
      <Link className="login-brand" href="/">
        <span className="brand-mark" aria-hidden="true">b.</span>
        <span><strong>BABE AGENCY</strong><small>AGENCY WORKSPACE</small></span>
      </Link>
      <h1 id="update-password-title">{flow === "invite" ? "Create your password" : "Choose a new password"}</h1>
      <p>{flow === "invite" ? "Set a password to activate your BABE AGENCY account." : "Use at least 8 characters. This form only works after opening a valid password link."}</p>
      {invalidLink ? <div className="form-error" role="alert">{flow === "invite" ? "Open a valid invitation link to verify your email before creating a password. Ask your workspace administrator to resend it if needed." : "Open a valid password link before choosing a new password."}</div> : <UpdatePasswordForm flow={flow} />}
      {invalidLink && flow === "recovery" && <Link className="ui-button ui-button-primary" href="/auth/forgot-password">Request another reset link</Link>}
      {invalidLink && flow === "invite" && <Link className="login-back-link" href="/login">Back to sign in</Link>}
    </section>
  </main>;
}
