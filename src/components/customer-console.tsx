"use client";
import type { AccountInfo } from "@/lib/providers/account";
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
import { ModelCosts } from "./model-costs";
import { MetricChart } from "./metric-chart";
import { UsageTooltip } from "./usage-tooltip";
import { ClientConnectionGuides } from "./client-connection-guides";
export type CustomerLog = {
  cacheRead?: number | null;
  cacheWrite?: number | null;
  charged?: string | null;
  ttft?: number | null;
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
  tools?: boolean;
  streaming?: boolean;
  contextWindow?: number;
  maxOutputTokens?: number;
};
type Props = {
  account?: AccountInfo | null;
  pricing?: import("@/lib/providers/pricing").PublishedPricing | null;
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
  const initialLogs = p.account ? (p.account.history?.logs ?? []) : p.logs;
  const accountStats = p.account?.stats;
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
                ...(p.account ? ["Cache read / write", "Charged", "TTFT"] : []),
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
                      l.status === "FAILED" || Number(l.status) >= 400
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
                {p.account && (
                  <>
                    <td>
                      {l.cacheRead?.toLocaleString() ?? "—"} /{" "}
                      {l.cacheWrite?.toLocaleString() ?? "—"}
                    </td>
                    <td>
                      {l.charged == null
                        ? "—"
                        : `${Number(l.charged).toFixed(4)}`}
                    </td>
                    <td>
                      {l.ttft == null ? "—" : `${(l.ttft / 1000).toFixed(2)}s`}
                    </td>
                  </>
                )}
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
            {p.account && !p.account.history && history === null
              ? "Account history is temporarily unavailable. Try again shortly."
              : "No requests in this view."}
          </p>
        )}
      </div>
    );
  }
  const displayModels = p.models.filter((m) => {
    const same = p.models.filter((other) => other.name === m.name);
    const canonical =
      same.find((other) => other.id.startsWith("v2/claude-")) || same[0];
    return canonical.id === m.id;
  });
  const catalog = p.account || p.pricing ? (
    <ModelCosts models={p.models} account={p.account ?? { history: null, stats: null, prices: p.pricing!.prices }} pricingNote={p.pricing?.note} />
  ) : (
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
        {displayModels
          .filter((m) =>
            `${m.id} ${m.name}`.toLowerCase().includes(search.toLowerCase()),
          )
          .map((m) => (
            <div key={m.id}>
              <strong>{m.name}</strong>
              <CopyValue value={m.id} />
              <small>{m.family}</small>
              {p.models.some(
                (other) => other.name === m.name && other.id !== m.id,
              ) && (
                <details>
                  <summary>Other accepted IDs</summary>
                  {p.models
                    .filter(
                      (other) => other.name === m.name && other.id !== m.id,
                    )
                    .map((other) => (
                      <CopyValue key={other.id} value={other.id} />
                    ))}
                </details>
              )}
              {p.account?.prices[m.id] && (
                <details>
                  <summary>
                    {money(p.account.prices[m.id].input)} / M input tokens
                  </summary>
                  <small>
                    Per million tokens: output{" "}
                    {money(p.account.prices[m.id].output)}, cache read{" "}
                    {money(p.account.prices[m.id].cacheRead)}, cache write{" "}
                    {money(p.account.prices[m.id].cacheWrite)}.
                  </small>
                </details>
              )}
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
                    value: p.account
                      ? accountStats?.success == null
                        ? "—"
                        : `${accountStats.success.toFixed(1)}%`
                      : p.stats.requests
                        ? `${(((p.stats.requests - p.stats.errors) / p.stats.requests) * 100).toFixed(1)}%`
                        : "—",
                    note: "Recorded requests over 30 days",
                  },
                  {
                    label: "Response speed",
                    value: p.account
                      ? accountStats?.latency == null
                        ? "—"
                        : `${(accountStats.latency / 1000).toFixed(2)}s`
                      : p.stats.requests
                        ? `${(p.stats.latency / 1000).toFixed(2)}s`
                        : "—",
                    note: p.account
                      ? accountStats?.p95 == null
                        ? "Median account request duration"
                        : `95% within ${(accountStats.p95 / 1000).toFixed(1)}s`
                      : "Average request duration",
                  },
                  {
                    label: p.account ? "Cache hit" : "Tokens",
                    value: p.account
                      ? accountStats?.cacheHit == null
                        ? "—"
                        : `${accountStats.cacheHit.toFixed(1)}%`
                      : p.stats.tokens.toLocaleString(),
                    note: p.account
                      ? "Account cache reads over 30 days"
                      : "Recorded tokens over 30 days",
                  },
                  {
                    label: "Today",
                    value: p.account
                      ? (accountStats?.today.toLocaleString() ?? "—")
                      : p.stats.today.toLocaleString(),
                    note: accountStats
                      ? `${money(accountStats.todaySpend)} charged since 00:00 UTC`
                      : "Requests since 00:00 UTC",
                  },
                ].map(({ label, value, note }) => (
                  <section className="console-panel" key={label}>
                    <div className="metric-heading">
                      <p>{label}</p>
                      <UsageTooltip
                        label={`${label} details`}
                        detail={
                          label === "Success rate"
                            ? accountStats
                              ? `${accountStats.requests.toLocaleString()} requests, ${accountStats.days.reduce((n, d) => n + d.errors, 0).toLocaleString()} errors over 30 days. Success excludes failed requests.`
                              : p.account
                                ? "Account statistics are unavailable."
                                : `${p.stats.requests.toLocaleString()} recorded requests, ${p.stats.errors.toLocaleString()} errors over 30 days.`
                            : label === "Response speed"
                              ? accountStats
                                ? `Median: ${accountStats.latency == null ? "unavailable" : (accountStats.latency / 1000).toFixed(2) + "s"}. 95th percentile: ${accountStats.p95 == null ? "unavailable" : (accountStats.p95 / 1000).toFixed(2) + "s"}. Account request duration over 30 days; not your browser network latency.`
                                : p.account
                                  ? "Account timing is unavailable."
                                  : "Average duration of requests recorded through Somiti over 30 days."
                              : label === "Cache hit"
                                ? accountStats
                                  ? `Cache read: ${accountStats.tokens.cacheRead?.toLocaleString() ?? "unavailable"} tokens. Cache write: ${accountStats.tokens.cacheWrite?.toLocaleString() ?? "unavailable"} tokens. Hit rate is reported by the account API for 30 days.`
                                  : "Account cache statistics are unavailable."
                                : label === "Tokens"
                                  ? `${p.stats.tokens.toLocaleString()} recorded tokens over 30 days.`
                                  : accountStats
                                    ? `${accountStats.today.toLocaleString()} requests and ${money(accountStats.todaySpend)} charged since 00:00 UTC.`
                                    : p.account
                                      ? "Today's account statistics are unavailable."
                                      : `${p.stats.today.toLocaleString()} requests recorded since 00:00 UTC.`
                        }
                      >
                        ⓘ
                      </UsageTooltip>
                    </div>
                    <strong>{value}</strong>
                    <small>{note}</small>
                    <MetricChart
                      label={label}
                      stats={accountStats}
                      logs={initialLogs}
                    />
                  </section>
                ))}
              </div>
              {p.account && !accountStats && (
                <p role="status">
                  Account statistics are temporarily unavailable.
                </p>
              )}
              {accountStats && (
                <section className="console-panel">
                  <h2>Daily spending</h2>
                  <p>Last 14 days · UTC</p>
                  <div className="account-spend-chart">
                    {Array.from({ length: 14 }, (_, i) => {
                      const date = new Date();
                      date.setUTCDate(date.getUTCDate() - 13 + i);
                      const day = date.toISOString().slice(0, 10);
                      const record = accountStats.days.find(
                        (d) => d.date === day,
                      );
                      const spend = record?.spend;
                      const max = Math.max(
                        1,
                        ...accountStats.days
                          .filter(
                            (d) =>
                              d.date >=
                              new Date(Date.now() - 14 * 86400000)
                                .toISOString()
                                .slice(0, 10),
                          )
                          .map((d) => Number(d.spend)),
                      );
                      return (
                        <div key={day}>
                          <UsageTooltip
                            label={`Spending on ${day}`}
                            detail={
                              <>
                                <b>
                                  {spend === undefined
                                    ? "Unavailable"
                                    : money(spend)}{" "}
                                  · {day} UTC
                                </b>
                                <br />
                                {record
                                  ? `${record.requests.toLocaleString()} requests · ${record.errors.toLocaleString()} errors`
                                  : "No daily record returned for this date."}
                              </>
                            }
                          >
                            <span
                              className="spend-bar"
                              style={{
                                height: `${Math.max(2, (Number(spend ?? 0) / max) * 130)}px`,
                              }}
                            />
                          </UsageTooltip>
                          <small>{day.slice(5)}</small>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
              {catalog}
              <section className="console-panel console-history">
                <div className="console-section-head">
                  <div>
                    <h2>Recent requests</h2>
                    <p>
                      {p.account
                        ? p.account.history
                          ? `${p.account.history.total.toLocaleString()} account requests total`
                          : "Account history unavailable"
                        : "Usage recorded through Somiti"}
                    </p>
                  </div>
                  <button onClick={() => setView("History")}>
                    Full history
                  </button>
                </div>
                {table(initialLogs.slice(0, 6))}
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
              {p.baseUrl.endsWith("/v2") ? (
                <ClientConnectionGuides
                  baseUrl={p.baseUrl}
                  models={p.models}
                  shareToken={p.shareToken}
                />
              ) : (
                <>
                  <ClientConnectionGuides
                    baseUrl={p.baseUrl}
                    models={p.models}
                    shareToken={p.shareToken}
                  />
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
                      <ol className="connection-steps">
                        <li>
                          Select an enabled model below. The example uses its
                          supported endpoint.
                        </li>
                        <li>
                          Reveal your Somiti key above and replace YOUR_API_KEY
                          in the example.
                        </li>
                        <li>
                          Run the example, then open History to confirm the
                          result.
                        </li>
                      </ol>
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
                        <p>
                          Connection examples appear when a model is enabled.
                        </p>
                      )}
                    </section>
                  </div>
                </>
              )}
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
                  Your balance is the actual remaining account quota. API v1
                  history covers requests sent through Somiti. API v2 also shows
                  account history when available. Per-request charges and cache
                  statistics are shown when provided by the account API.
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
                  {p.account ? "Filter this page by model" : "Filter model"}
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
              {table(
                (history ?? initialLogs).filter(
                  (l) => !p.account || !filter || l.model === filter,
                ),
              )}
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
                  disabled={busy || (history ?? initialLogs).length < 25}
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
