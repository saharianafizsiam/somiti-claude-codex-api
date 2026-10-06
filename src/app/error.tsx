"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="content">
      <h1>We couldn’t load this page</h1>
      <p className="muted">
        Check your connection. If this is a new installation, confirm the
        database configuration and migrations.
      </p>
      <button className="button button-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
