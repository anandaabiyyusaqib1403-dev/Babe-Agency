import Link from "next/link";

export function SetupNotice() {
  return <main className="access-page"><div className="access-mark">b.</div><h1>Connect your workspace</h1><p>Supabase credentials are not configured yet. Add the project URL and anon key to <code>.env.local</code>, apply the foundation migration, then sign in with an invited member account.</p><Link className="button" href="/">Return to overview</Link></main>;
}
