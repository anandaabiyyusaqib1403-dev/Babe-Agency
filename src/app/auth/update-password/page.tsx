import type { Metadata } from "next";
import Link from "next/link";
import { UpdatePasswordForm } from "@/components/password-reset-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function UpdatePasswordPage() {
  return <main className="login-page">
    <section className="login-card" aria-labelledby="update-password-title">
      <Link className="login-brand" href="/">
        <span className="brand-mark" aria-hidden="true">b.</span>
        <span><strong>BABE AGENCY</strong><small>AGENCY WORKSPACE</small></span>
      </Link>
      <h1 id="update-password-title">Choose a new password</h1>
      <p>Use at least 8 characters. This form only works after opening a valid reset link.</p>
      <UpdatePasswordForm />
    </section>
  </main>;
}
