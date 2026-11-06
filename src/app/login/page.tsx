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
      <p>Sign in with your BABE AGENCY email and password.</p>
      <LoginForm />
      <div className="login-footnote">Use the temporary password shared by BABE AGENCY. Change it under Studio Settings → Security after signing in. Contact your workspace administrator if you need an account.</div>
    </section>
  </main>;
}
