import Link from "next/link";
export default function NotFound() {
  return (
    <main className="content">
      <h1>This page is unavailable</h1>
      <p className="muted">The link may be invalid, expired, or disabled.</p>
      <Link className="button button-secondary" href="/">
        Return home
      </Link>
    </main>
  );
}
