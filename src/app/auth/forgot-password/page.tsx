import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/password-reset-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <main className="login-page">
    <section className="login-card" aria-labelledby="recovery-title">
      <Link className="login-brand" href="/">
        <span className="brand-mark" aria-hidden="true">b.</span>
        <span><strong>BABE AGENCY</strong><small>AGENCY WORKSPACE</small></span>
      </Link>
      <h1 id="recovery-title">Reset your password</h1>
      <p>Enter the email address for your agency account. If it matches an account, we’ll send a reset link.</p>
      <ForgotPasswordForm />
    </section>
  </main>;
}
