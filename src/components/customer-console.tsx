"use client";
import { useState } from "react";
import {
  LayoutGrid,
  Plug,
  BookOpen,
  History,
  ArrowUpRight,
} from "lucide-react";
import { CopyValue, SecretReveal } from "./actions";
import { AutoRefresh } from "./refresh";
export type CustomerLog = {
  id: string;
  model: string | null;
  input: number | null;
  output: number | null;
  latency: number | null;
  status: string;
  created: string;
};
type Model = {
  id: string;
  name: string;
  family: string;
  openai: boolean;
  anthropic: boolean;
};
type Props = {
  name: string;
  shareToken: string;
  prefix: string;
  status: string;
  baseUrl: string;
  quota: {
    remaining: string | null;
    used: string | null;
    allocated: string | null;
    checkedAt: string | null;
  };
  stats: {
    requests: number;
    errors: number;
    today: number;
    latency: number;
    tokens: number;
  };
  models: Model[];
  logs: CustomerLog[];
};
const money = (v: string | null) =>
  v === null
    ? "Unavailable"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(Number(v));
const sections = [
  { name: "Overview", icon: LayoutGrid },
  { name: "Connect", icon: Plug },
  { name: "Documentation", icon: BookOpen },
  { name: "History", icon: History },
];
export function CustomerConsole(p: Props) {
  const [view, setView] = useState("Overview");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<CustomerLog[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [client, setClient] = useState("cURL");
  const [selected, setSelected] = useState(p.models[0]?.id || "");
  const model = p.models.find((m) => m.id === selected) || p.models[0];
  const anthropic = model?.anthropic && !model.openai;
  const path = anthropic ? "/messages" : "/chat/completions";
  const body = {
    model: model?.id || "YOUR_MODEL_ID",
    ...(anthropic ? { max_tokens: 1024 } : {}),
    messages: [{ role: "user", content: "Hello" }],
  };
  const headers: Record<string, string> = anthropic
    ? {
        "x-api-key": "YOUR_API_KEY",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      }
    : {
        Authorization: "Bearer YOUR_API_KEY",
        "Content-Type": "application/json",
      };
  const code =
    client === "JavaScript"
      ? `const response = await fetch("${p.baseUrl}${path}", {\n  method: "POST",\n  headers: ${JSON.stringify(headers, null, 2)},\n  body: JSON.stringify(${JSON.stringify(body, null, 2)})\n});\nconsole.log(await response.json());`
      : client === "PowerShell"
        ? `$headers = @{${Object.entries(headers)
            .map(([k, v]) => `'${k}' = '${v}'`)
            .join(
              "; ",
            )}}\n$body = @'\n${JSON.stringify(body, null, 2)}\n'@\nInvoke-RestMethod -Uri '${p.baseUrl}${path}' -Method Post -Headers $headers -Body $body`
        : `curl '${p.baseUrl}${path}' ${Object.entries(headers)
            .map(([k, v]) => `-H '${k}: ${v}'`)
            .join(" ")} -d '${JSON.stringify(body)}'`;
  const percentage =
    p.quota.remaining !== null && Number(p.quota.allocated) > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (Number(p.quota.remaining) / Number(p.quota.allocated)) * 100,
          ),
        )
      : 0;
  const low = p.quota.remaining !== null && percentage < 15;
  async function loadHistory(next: number) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/share/${p.shareToken}/history?${new URLSearchParams({ page: String(next), model: filter })}`,
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error(
          "Could not load history. Check that your dashboard link is still active.",
        );
      setHistory((await response.json()).logs);
      setPage(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function table(rows: CustomerLog[]) {
    return (
      <div className="console-table">
        <table>
          <thead>
            <tr>
              {[
                "Time (UTC)",
                "Model",
                "Status",
                "Input / Output",
                "Latency",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td>
                  <strong>{l.created.slice(11, 19)}</strong>
                  <small>{l.created.slice(0, 10)}</small>
                </td>
                <td>
                  <code>{l.model || "Unknown"}</code>
                </td>
                <td>
                  <span
                    className={
                      l.status === "FAILED"
                        ? "console-danger"
                        : "console-success"
                    }
                  >
                    {l.status}
                  </span>
                </td>
                <td>
                  {l.input?.toLocaleString() ?? "—"} /{" "}
                  {l.output?.toLocaleString() ?? "—"}
                </td>
                <td>
                  {l.latency === null
                    ? "—"
                    : `${(l.latency / 1000).toFixed(2)}s`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="console-empty">
            No requests yet. Your requests will appear here after you connect.
          </p>
        )}
      </div>
    );
  }
  const catalog = (
    <section className="console-panel">
      <div className="console-section-head">
        <div>
          <h2>Available models</h2>
          <p>Copy an exact model ID into your client.</p>
        </div>
        <input
          aria-label="Search models"
          placeholder="Search models…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="console-models">
        {p.models
          .filter((m) =>
            `${m.id} ${m.name}`.toLowerCase().includes(search.toLowerCase()),
          )
          .map((m) => (
            <div key={m.id}>
              <strong>{m.name}</strong>
              <CopyValue value={m.id} />
              <small>{m.family}</small>
            </div>
          ))}
      </div>
      {!p.models.length && (
        <p className="console-empty">
          No models have been enabled for this key yet. Contact your account
          administrator.
        </p>
      )}
    </section>
  );
  return (
    <div className="customer-console">
      <AutoRefresh />
      <aside className="console-sidebar">
        <div className="console-brand">
          <span>
            <LayoutGrid size={20} />
          </span>
          <div>
            <strong>SOMITI API</strong>
            <small>Private dashboard</small>
          </div>
        </div>
        <nav aria-label="Dashboard sections">
          {sections.map(({ name, icon: Icon }) => (
            <button
              key={name}
              aria-current={view === name ? "page" : undefined}
              onClick={() => {
                setView(name);
                window.scrollTo({ top: 0 });
              }}
            >
              <Icon size={17} />
              {name}
            </button>
          ))}
        </nav>
        <div className="console-sidebar-foot">
          <span
            className={
              p.status === "ACTIVE" ? "console-success" : "console-danger"
            }
          >
            ● {p.status}
          </span>
          <small>{p.name}</small>
        </div>
      </aside>
      <div className="console-workspace">
        <header className="console-topbar">
          <h1>{view}</h1>
          <span
            className={
              low ? "console-balance console-danger" : "console-balance"
            }
          >
            {money(p.quota.remaining)}
          </span>
        </header>
        <main className="console-content">
          {view === "Overview" && (
            <>
              <button
                className="console-connect-banner"
                onClick={() => setView("Connect")}
              >
                <Plug size={20} />
                <span>
                  <strong>Connect your API</strong>
                  <small>Choose a model and copy your first request.</small>
                </span>
                <ArrowUpRight size={20} />
              </button>
              <section className="console-panel console-quota">
                <p>Balance remaining</p>
                <div
                  className={`console-amount ${low ? "console-danger" : ""}`}
                >
                  {money(p.quota.remaining)}
                </div>
                <progress
                  aria-label="Balance remaining"
                  max={100}
                  value={percentage}
                />
                <small>
                  {p.quota.remaining === null
                    ? "Quota is temporarily unavailable"
                    : `${percentage.toFixed(1)}% left`}
                </small>
                <div className="console-allocation">
                  <div>
                    Spent<strong>{money(p.quota.used)}</strong>
                  </div>
                  <div>
                    Total allocated<strong>{money(p.quota.allocated)}</strong>
                  </div>
                  <div>
                    Balance source<strong>Live account quota</strong>
                  </div>
                </div>
                {low && (
                  <p className="console-danger">
                    Low balance. Requests may be rejected when your quota runs
                    out.
                  </p>
                )}
                <h2>API configuration</h2>
                <label>Your API key</label>
                <SecretReveal prefix={p.prefix} shareToken={p.shareToken} />
                <label>API base URL</label>
                <CopyValue value={p.baseUrl} />
                <small>
                  Keep your API key and this dashboard link private. This key
                  works only on the route above.
                </small>
              </section>
              <div className="console-metrics">
                {[
                  {
                    label: "Success rate",
                    value: p.stats.requests
                      ? `${(((p.stats.requests - p.stats.errors) / p.stats.requests) * 100).toFixed(1)}%`
                      : "—",
                    note: "Recorded requests over 30 days",
                  },
                  {
                    label: "Response speed",
                    value: p.stats.requests
                      ? `${(p.stats.latency / 1000).toFixed(2)}s`
                      : "—",
                    note: "Average request duration",
                  },
                  {
                    label: "Tokens",
                    value: p.stats.tokens.toLocaleString(),
                    note: "Recorded tokens over 30 days",
                  },
                  {
                    label: "Today",
                    value: p.stats.today.toLocaleString(),
                    note: "Requests since 00:00 UTC",
                  },
                ].map(({ label, value, note }) => (
                  <section className="console-panel" key={label}>
                    <p>{label}</p>
                    <strong>{value}</strong>
                    <small>{note}</small>
                  </section>
                ))}
              </div>
              {catalog}
              <section className="console-panel console-history">
                <div className="console-section-head">
                  <div>
                    <h2>Recent requests</h2>
                    <p>Usage recorded through Somiti</p>
                  </div>
                  <button onClick={() => setView("History")}>
                    Full history
                  </button>
                </div>
                {table(p.logs.slice(0, 6))}
              </section>
            </>
          )}
          {view === "Connect" && (
            <>
              <section className="console-panel">
                <h2>API configuration</h2>
                <p>Use this base URL and your Somiti API key.</p>
                <CopyValue value={p.baseUrl} />
                <SecretReveal prefix={p.prefix} shareToken={p.shareToken} />
              </section>
              <div className="console-connect-grid">
                <aside className="console-panel">
                  <h2>Clients</h2>
                  {["cURL", "JavaScript", "PowerShell"].map((c) => (
                    <button
                      aria-pressed={client === c}
                      key={c}
                      onClick={() => setClient(c)}
                    >
                      {c}
                    </button>
                  ))}
                </aside>
                <section className="console-panel">
                  <h2>Your first request</h2>
                  <label>
                    Model
                    <select
                      value={model?.id || ""}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      <option value="" disabled>
                        Select a model
                      </option>
                      {p.models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {m.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    Replace YOUR_API_KEY with your key above.{" "}
                    {client === "cURL"
                      ? "Run in macOS / Linux terminal."
                      : client === "JavaScript"
                        ? "Run on your server; keep your key out of public browser code."
                        : "Run in Windows PowerShell."}
                  </p>
                  {model ? (
                    <CopyValue value={code} />
                  ) : (
                    <p>Connection examples appear when a model is enabled.</p>
                  )}
                </section>
              </div>
            </>
          )}
          {view === "Documentation" && (
            <>
              <section className="console-panel console-docs">
                <h2>Quick start</h2>
                <p>Connect your application to Somiti in three steps.</p>
                <ol>
                  <li>Open Connect and copy your API base URL and key.</li>
                  <li>Choose a model from the available models below.</li>
                  <li>Send a request using the matching connection example.</li>
                </ol>
                <h3>Authentication</h3>
                <p>
                  For chat completions use Authorization: Bearer YOUR_API_KEY.
                  For messages use x-api-key and anthropic-version: 2023-06-01.
                </p>
                <h3>Quota and usage</h3>
                <p>
                  Your balance is the actual remaining account quota. Dashboard
                  usage covers requests sent through Somiti. Per-request
                  monetary charges and cache statistics are not available here.
                </p>
                <h3>Errors and retries</h3>
                <p>
                  401: check your API key. 403: check model permissions and the
                  assigned API route. 429: slow down and retry with backoff. For
                  server errors, retry briefly and contact your administrator if
                  they persist.
                </p>
                <h3>Privacy</h3>
                <p>
                  Keep your key in your server environment. Anyone with this
                  private dashboard link can view your usage and reveal your API
                  key.
                </p>
              </section>
              {catalog}
            </>
          )}
          {view === "History" && (
            <section className="console-panel console-history">
              <div className="console-section-head">
                <div>
                  <h2>Request history</h2>
                  <p>All times are UTC</p>
                </div>
                <label>
                  Filter model
                  <input
                    aria-label="History model ID"
                    placeholder="Exact model ID"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </label>
                <button disabled={busy} onClick={() => loadHistory(1)}>
                  Apply filter
                </button>
              </div>
              {table(history ?? p.logs)}
              {error && <p role="alert">{error}</p>}
              <div className="console-pagination">
                <button
                  disabled={busy || page === 1}
                  onClick={() => loadHistory(page - 1)}
                >
                  Previous
                </button>
                <span>Page {page}</span>
                <button
                  disabled={busy || (history ?? p.logs).length < 25}
                  onClick={() => loadHistory(page + 1)}
                >
                  Next
                </button>
              </div>
            </section>
          )}
          <footer className="console-footer">
            <strong>SOMITI API</strong>
            <span>Balance and overview refresh every 30 seconds.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
