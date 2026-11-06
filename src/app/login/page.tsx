import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <main className="login-page">
    <section className="login-card" aria-labelledby="login-title">
      <Link className="login-brand" href="/">
        <span className="brand-mark" aria-hidden="true">b.</span>
        <span><strong>BABE AGENCY</strong><small>AGENCY WORKSPACE</small></span>
      </Link>
      <h1 id="login-title">Welcome back</h1>
      <p>Sign in to continue to your agency workspace.</p>
      <LoginForm />
      <div className="login-footnote">First time here? Open your invitation email to create your password. Access is by invitation only; contact your workspace administrator if you need an account.</div>
    </section>
  </main>;
}
