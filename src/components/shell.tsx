import Link from "next/link";
import {
  Activity,
  Box,
  KeyRound,
  LayoutDashboard,
  List,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Logout } from "./actions";
export function Brand({ name = "Somiti API" }: { name?: string }) {
  return (
    <Link className="brand" href="/">
      <span className="brand-mark">S</span>
      {name}
    </Link>
  );
}
const nav = [
  ["Overview", "", LayoutDashboard],
  ["API Keys", "keys", KeyRound],
  ["Models", "models", Box],
  ["Usage", "usage", Activity],
  ["Request Logs", "logs", List],
  ["Audit Logs", "audit", ShieldCheck],
  ["Settings", "settings", Settings],
] as const;
export function Shell({
  children,
  section,
  name,
  email,
  appName,
}: {
  children: React.ReactNode;
  section: string;
  name: string;
  email: string;
  appName?: string;
}) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand name={appName} />
        <div className="workspace">Your workspace</div>
        <nav className="nav" aria-label="Workspace navigation">
          {nav.map(([label, path, Icon]) => (
            <Link
              key={path}
              aria-current={section === path ? "page" : undefined}
              className={section === path ? "active" : ""}
              href={`/dashboard${path ? `/${path}` : ""}`}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="account">
            <span className="avatar">{name[0]}</span>
            <div>
              {name}
              <br />
              <span className="muted">{email}</span>
            </div>
          </div>
          <Logout />
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>
            Workspace / {nav.find((n) => n[1] === section)?.[0] || "Overview"}
          </span>
          <span>
            Somiti console <span className="status-dot" />
          </span>
          <div className="mobile-logout">
            <Logout />
          </div>
        </header>
        <main className="content">
          <details className="workspace-help">
            <summary>How to use this workspace</summary>
            <div className="workspace-help-grid">
              <div>
                <strong>1. Prepare models</strong>
                <p>
                  Open Models to import the catalog and check supported
                  endpoints before giving access.
                </p>
              </div>
              <div>
                <strong>2. Create customer access</strong>
                <p>
                  Create one key for API v1 or API v2, attach its account
                  credential, and choose allowed models.
                </p>
              </div>
              <div>
                <strong>3. Share and monitor</strong>
                <p>
                  Share the private customer dashboard. Credit comes from its
                  account; request logs help diagnose calls through Somiti.
                </p>
              </div>
            </div>
          </details>
          {children}
        </main>
      </div>
    </div>
  );
}
