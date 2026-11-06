"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="access-page"><div className="access-mark">b.</div><h1>That didn’t load</h1><p>The workspace could not load this page. Try again, or return to the overview.</p><button className="button button-primary" onClick={reset}>Try again</button></main>;
}
