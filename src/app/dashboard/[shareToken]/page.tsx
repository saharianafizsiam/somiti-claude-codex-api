import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { availableModels, sharedKey } from "@/lib/api-keys";
import { apiRequests, settings } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { remaining, prices } from "@/lib/billing/money";
import { usage, requestLogs } from "@/server/queries";
import { Brand } from "@/components/shell";
import {
  Badge,
  Chart,
  DataTable,
  Heading,
  Metric,
  Pagination,
  usd,
} from "@/components/data";
import { CopyValue, SecretReveal } from "@/components/actions";
import { AutoRefresh } from "@/components/refresh";
export const dynamic = "force-dynamic";
export default async function Customer({
  params,
  searchParams,
}: {
  params: Promise<{ shareToken: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { shareToken } = await params;
  const search = await searchParams;
  const key = await sharedKey(shareToken);
  if (!key) notFound();
  const period = ["today", "7d", "30d", "all"].includes(search.period || "")
    ? search.period!
    : "30d";
  const page = Math.max(1, Math.min(100000, parseInt(search.page || "1") || 1));
  const [catalog, { stats, daily, byModel }, logs, [config]] =
    await Promise.all([
      availableModels(key),
      usage(eq(apiRequests.apiKeyId, key.id), period),
      requestLogs(eq(apiRequests.apiKeyId, key.id), page),
      db().select().from(settings).limit(1),
    ]);
  const apiUrl = (
    config?.publicApiUrl ||
    process.env.API_URL ||
    "https://api.somiti.page"
  ).replace(/\/$/, "");
  const base = `/dashboard/${shareToken}`;
  const openai = catalog.find((m) => m.supportsOpenaiEndpoint);
  const anthropic = catalog.find((m) => m.supportsAnthropicEndpoint);
  return (
    <main className="customer">
      <AutoRefresh />
      <header className="customer-header">
        <Brand name={config?.applicationName} />
        <span className="muted">Private customer dashboard</span>
      </header>
      <Heading
        title={key.name}
        text="Your API access, balance, and usage in one place."
      >
        <Badge
          value={
            key.expiresAt && key.expiresAt <= new Date()
              ? "EXPIRED"
              : key.status
          }
        />
      </Heading>
      <nav className="tabs">
        {["Overview", "API setup", "Models", "Usage", "Logs"].map((t) => (
          <a key={t} href={`#${t.replaceAll(" ", "-").toLowerCase()}`}>
            {t}
          </a>
        ))}
      </nav>
      <section id="overview">
        <div className="metrics">
          <Metric
            label="Available credit"
            value={usd(remaining(key))}
            note="Ready to use"
          />
          <Metric
            label="Used credit"
            value={usd(key.creditUsed)}
            note="All-time settled usage"
          />
          <Metric
            label="Total allocated"
            value={usd(key.totalAllocatedCredit)}
            note="Lifetime credit allocated"
          />
          <Metric
            label="Reserved credit"
            value={usd(key.creditReserved)}
            note="Requests in progress"
          />
        </div>
      </section>
      <section className="panel" id="api-setup">
        <h2>API configuration</h2>
        <p className="muted">
          {key.modelAccessMode.replaceAll("_", " ")} · {key.rateLimitPerMinute}{" "}
          requests/minute
        </p>
        <label>API v1 base URL</label>
        <CopyValue value={`${apiUrl}/v1`} />
        <label>API v2 base URL</label>
        <CopyValue value={`${apiUrl}/v2`} />
        <p>
          Use the route listed beside your model. Both routes share your API
          key, balance and total usage.
        </p>
        <label>API key</label>
        <SecretReveal shareToken={shareToken} prefix={key.keyPrefix} />
        <p className="setup-note">
          Keep your API key and this private dashboard link secure.
        </p>
        {openai && (
          <>
            <h3>OpenAI-compatible request</h3>
            <CopyValue
              value={`curl ${apiUrl}/${openai.provider === "claude-n-codex" ? "v2" : "v1"}/chat/completions -H "Authorization: Bearer YOUR_API_KEY" -H "Content-Type: application/json" -d '${JSON.stringify({ model: openai.publicModelId, messages: [{ role: "user", content: "Hello" }] })}'`}
            />
          </>
        )}
        {anthropic && (
          <>
            <h3>Anthropic-compatible request</h3>
            <CopyValue
              value={`curl ${apiUrl}/${anthropic.provider === "claude-n-codex" ? "v2" : "v1"}/messages -H "x-api-key: YOUR_API_KEY" -H "anthropic-version: 2023-06-01" -H "Content-Type: application/json" -d '${JSON.stringify({ model: anthropic.publicModelId, max_tokens: 1024, messages: [{ role: "user", content: "Hello" }] })}'`}
            />
          </>
        )}
      </section>
      <section className="panel" id="models">
        <h2>Available models</h2>
        <DataTable
          headers={[
            "Model",
            "Public model ID",
            "API route",
            "Family",
            "Input / 1M",
            "Output / 1M",
            "Streaming",
          ]}
          rows={catalog.map((m) => [
            m.displayName,
            m.publicModelId,
            m.provider === "claude-n-codex" ? "/v2" : "/v1",
            m.family,
            usd(prices(m).input, 4),
            usd(prices(m).output, 4),
            m.supportsStreaming ? "Supported" : "Not supported",
          ])}
        />
      </section>
      <section id="usage">
        <Heading
          title="Usage"
          text="Confirmed usage and spending. All dates use UTC."
        />
        <div className="tabs">
          {[
            ["today", "Today"],
            ["7d", "7 days"],
            ["30d", "30 days"],
            ["all", "All time"],
          ].map(([v, l]) => (
            <Link
              key={v}
              className={v === period ? "active" : ""}
              href={`${base}?period=${v}#usage`}
            >
              {l}
            </Link>
          ))}
        </div>
        <div className="metrics">
          <Metric label="Requests" value={stats.requests} />
          <Metric label="Input tokens" value={stats.inputTokens} />
          <Metric label="Output tokens" value={stats.outputTokens} />
          <Metric label="Total tokens" value={stats.totalTokens} />
          <Metric label="Spend" value={usd(stats.spend, 6)} />
          <Metric
            label="Average request cost"
            value={usd(stats.averageCost, 6)}
          />
          <Metric
            label="Average latency"
            value={`${stats.averageLatency} ms`}
          />
          <Metric label="Failed requests" value={stats.errors} />
        </div>
        <div className="grid-two">
          <section className="panel">
            <h2>Daily spending</h2>
            <Chart daily={daily} />
          </section>
          <section className="panel">
            <h2>Daily requests</h2>
            <Chart daily={daily} field="requests" />
          </section>
        </div>
        <section className="panel">
          <h2>Model usage</h2>
          <DataTable
            headers={["Model", "Family", "Requests", "Tokens", "Spend"]}
            rows={byModel.map((m) => [
              m.model,
              m.family,
              m.requests,
              m.tokens,
              usd(m.spend, 6),
            ])}
          />
        </section>
      </section>
      <section className="panel" id="logs">
        <h2>Request logs</h2>
        <DataTable
          headers={[
            "Time (UTC)",
            "Request ID",
            "Model",
            "Endpoint",
            "Input",
            "Output",
            "Total",
            "Cost",
            "Latency",
            "Status",
            "Usage",
          ]}
          rows={logs.map((l) => [
            l.created.toISOString(),
            l.id,
            l.model,
            l.endpoint,
            l.input ?? "—",
            l.output ?? "—",
            l.total ?? "—",
            usd(l.cost, 8),
            `${l.latency ?? "—"} ms`,
            <Badge key="s" value={l.status} />,
            l.usage,
          ])}
        />
        <Pagination
          page={page}
          more={logs.length === 25}
          base={`${base}?period=${period}`}
        />
      </section>
      <p className="setup-note">
        Updates automatically every 30 seconds. Usage without provider-confirmed
        token counts is marked unavailable.
      </p>
    </main>
  );
}
