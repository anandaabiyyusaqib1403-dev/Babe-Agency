import type { Metadata } from "next";
import Link from "next/link";
import { UpdatePasswordForm } from "@/components/password-reset-forms";

export const metadata: Metadata = { title: "Create your password" };

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ flow?: string; link?: string }> }) {
  const params = await searchParams;
  const flow = params.flow === "invite" ? "invite" : "recovery";
  const invalidLink = params.link === "invalid";
  return <main className="login-page">
    <section className="login-card" aria-labelledby="update-password-title">
      <Link className="login-brand" href="/">
        <span className="brand-mark" aria-hidden="true">b.</span>
        <span><strong>BABE AGENCY</strong><small>AGENCY WORKSPACE</small></span>
      </Link>
      <h1 id="update-password-title">{flow === "invite" ? "Create your password" : "Choose a new password"}</h1>
      <p>{flow === "invite" ? "Set a password to activate your BABE AGENCY account." : "Use at least 8 characters. This form only works after opening a valid password link."}</p>
      {invalidLink ? <div className="form-error" role="alert">{flow === "invite" ? "This activation link is invalid or expired. Ask your workspace administrator to resend it." : "This password link is invalid or expired. Request a new reset link."}</div> : <UpdatePasswordForm flow={flow} />}
      {invalidLink && flow === "recovery" && <Link className="ui-button ui-button-primary" href="/auth/forgot-password">Request another reset link</Link>}
    </section>
  </main>;
}
