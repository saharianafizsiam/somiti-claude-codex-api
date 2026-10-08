import Link from "next/link";
import { notFound } from "next/navigation";
import {
  and,
  desc,
  eq,
  getTableColumns,
  gte,
  isNull,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import { Plus, ArrowUpRight, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import {
  apiKeys,
  apiKeyModels,
  apiRequests,
  auditLogs,
  balanceTransactions,
  dashboardShares,
  modelAliases,
  models,
  settings,
  wallets,
} from "@/lib/db/schema";
import { pageUser, requireAdmin } from "@/lib/auth";
import { decrypt } from "@/lib/security/secrets";
import { keyQuota } from "@/lib/providers/quota";
import { prices } from "@/lib/billing/money";
import { providerConfigured } from "@/lib/providers/mwapi";
import {
  ProviderSelector,
  ProviderDiscovery,
} from "@/components/provider-browser";
import { ProviderGuide } from "@/components/provider-guide";
import { configured } from "@/lib/providers/compatible";
import { usage, ownerRequestLogs as requestLogs } from "./queries";
import { availableModels } from "@/lib/api-keys";
import { Shell } from "@/components/shell";
import {
  Badge,
  Chart,
  DataTable,
  Empty,
  Heading,
  Metric,
  Pagination,
  usd,
} from "@/components/data";
import { Button } from "@/components/ui/button";
import { ActionButton, CopyValue, SecretReveal } from "@/components/actions";
import { KeyForm, ModelForm, SettingsForm } from "@/components/forms";
type Params = Record<string, string | undefined>;
export async function OwnerPage({
  section = "",
  id,
  search = {},
}: {
  section?: string;
  id?: string;
  search?: Params;
}) {
  const user = await pageUser();
  requireAdmin(user);
  if (["redeem", "transactions"].includes(section)) notFound();
  if (
    id &&
    id !== "new" &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    notFound();
  const admin = ["OWNER", "ADMIN"].includes(user.role);
  const [config] = await db().select().from(settings).limit(1);
  const ownerWhere = eq(apiKeys.ownerUserId, user.id);
  const page = Math.min(100000, Math.max(1, parseInt(search.page || "1") || 1));
  const period = ["today", "7d", "30d", "all"].includes(search.period || "")
    ? search.period!
    : "30d";
  let content: React.ReactNode;
  if (!section || section === "usage") {
    const [{ stats, daily, byModel }, [counts]] = await Promise.all([
      usage(ownerWhere, section ? period : "all"),
      db()
        .select({
          count: sql<string>`count(*) filter (where status = 'ACTIVE' and (expires_at is null or expires_at > now()))`,
          models: sql<string>`(select count(*) from models where enabled = true and archived_at is null)`,
        })
        .from(apiKeys)
        .where(ownerWhere),
    ]);
    const logs = await requestLogs(ownerWhere);
    content = (
      <>
        <Heading
          title={section ? "Usage analytics" : "Overview"}
          text={
            section
              ? "Understand your traffic, revenue, and model performance."
              : "Your API business, at a glance."
          }
        >
          <Button asChild>
            <Link href="/dashboard/keys/new">
              <Plus size={16} />
              Create API key
            </Link>
          </Button>
        </Heading>
        {!section && !Number(counts.count) && (
          <div className="onboarding">
            <Wallet size={30} />
            <div>
              <h3 style={{ margin: 0 }}>Your workspace is ready to grow</h3>
              <p>
                Add models and attach an upstream key to your first customer
                key.
              </p>
            </div>
            <Button asChild variant="secondary">
              <Link href="/dashboard/models/new">
                Add a model <ArrowUpRight size={15} />
              </Link>
            </Button>
          </div>
        )}
        {section && <PeriodTabs base="/dashboard/usage" period={period} />}
        <div className="metrics">
          {section ? (
            <>
              <Metric
                label="Local charges (legacy)"
                value={usd(stats.spend)}
                note="Settled customer charges"
              />
              <Metric
                label="API requests"
                value={stats.requests}
                note="Accepted requests"
              />
              <Metric label="Total tokens" value={stats.totalTokens} />
              <Metric
                label="Average latency"
                value={`${stats.averageLatency} ms`}
              />
            </>
          ) : (
            <>
              <Metric label="Active customer keys" value={counts.count} />
              <Metric label="API requests" value={stats.requests} />
              <Metric label="Total tokens" value={stats.totalTokens} />
              <Metric label="Failed requests" value={stats.errors} />
            </>
          )}
        </div>
        <div className="grid-two">
          <section className="panel">
            <h2>
              Daily requests{" "}
              <span className="muted" style={{ float: "right", fontSize: 12 }}>
                Last 30 days · UTC
              </span>
            </h2>
            <Chart daily={daily} field="requests" />
          </section>
          <section className="panel">
            <h2>Model activity</h2>
            {byModel.length ? (
              byModel.slice(0, 5).map((m) => (
                <div className="model-row" key={m.model}>
                  <div className="model-name">
                    <span className="family-icon">{m.family[0]}</span>
                    <div>
                      {m.model}
                      <div className="muted" style={{ fontSize: 12 }}>
                        {m.requests} requests
                      </div>
                    </div>
                  </div>
                  <b>{usd(m.spend)}</b>
                </div>
              ))
            ) : (
              <Empty
                title="Models are waiting"
                text="Requests will populate your model breakdown."
              />
            )}
          </section>
        </div>
        <div className="metrics">
          <Metric label="Active API keys" value={counts.count} />
          <Metric label="Total requests" value={stats.requests} />
          <Metric label="Requests today" value={stats.today} />
          <Metric label="Requests this month" value={stats.month} />
          <Metric label="Active models" value={counts.models} />
          <Metric label="Total tokens" value={stats.totalTokens} />
          <Metric label="Estimated upstream cost" value={usd(stats.upstream)} />
          <Metric
            label="Average request cost"
            value={usd(stats.averageCost, 6)}
          />
        </div>
        {section && (
          <>
            <section className="panel">
              <h2>Daily requests</h2>
              <Chart daily={daily} field="requests" />
            </section>
            <section className="panel">
              <h2>Models & families</h2>
              <DataTable
                headers={["Model", "Family", "Requests", "Tokens", "Revenue"]}
                rows={byModel.map((m) => [
                  m.model,
                  m.family,
                  m.requests,
                  m.tokens,
                  usd(m.spend, 6),
                ])}
              />
            </section>
          </>
        )}
        <section className="panel">
          <h2>
            Recent requests{" "}
            <Link
              href="/dashboard/logs"
              className="muted"
              style={{ float: "right", fontSize: 12 }}
            >
              View all
            </Link>
          </h2>
          <LogTable logs={logs.slice(0, 8)} />
        </section>
      </>
    );
  } else if (section === "keys") {
    if (id === "new") {
      const all = await db()
        .select()
        .from(models)
        .where(eq(models.enabled, true));
      content = (
        <>
          <Heading
            title="Create API key"
            text="Connect one customer key to one upstream key and API route."
          />
          <KeyForm
            models={all}
            initial={{ rateLimitPerMinute: config?.defaultRateLimit || 60 }}
          />
        </>
      );
    } else if (id) {
      const [key] = await db()
        .select()
        .from(apiKeys)
        .where(and(ownerWhere, eq(apiKeys.id, id)));
      if (!key || key.deletedAt) notFound();
      const quota = await keyQuota(key);
      const keyLogs = await requestLogs(eq(apiRequests.apiKeyId, id), page);
      const allowed = await availableModels(key);
      const [all, selected, [share], data] = await Promise.all([
        db().select().from(models),
        db().select().from(apiKeyModels).where(eq(apiKeyModels.apiKeyId, id)),
        db()
          .select()
          .from(dashboardShares)
          .where(eq(dashboardShares.apiKeyId, id)),
        usage(eq(apiRequests.apiKeyId, id)),
      ]);
      content = (
        <>
          <Heading
            title={key.name}
            text={`${key.modelAccessMode.replaceAll("_", " ")} · Created ${key.createdAt.toISOString().slice(0, 10)}`}
          >
            <Badge value={key.status} />
          </Heading>
          <div className="metrics">
            <Metric
              label="Available credit"
              value={
                quota.remaining === null ? "Unavailable" : usd(quota.remaining)
              }
            />
            <Metric
              label="Used credit"
              value={quota.used === null ? "Unavailable" : usd(quota.used)}
            />
            <Metric
              label="API route"
              value={
                key.upstreamProvider === "claude-n-codex" ? "API v2" : "API v1"
              }
            />
            <Metric label="Requests" value={data.stats.requests} />
            <Metric label="Input tokens" value={data.stats.inputTokens} />
            <Metric label="Output tokens" value={data.stats.outputTokens} />
            <Metric label="Total tokens" value={data.stats.totalTokens} />
            <Metric
              label="Last used"
              value={key.lastUsedAt?.toISOString().slice(0, 10) || "Never"}
            />
          </div>
          <section className="panel">
            <h2>API credential</h2>
            <SecretReveal keyId={id} prefix={key.keyPrefix} />
            <label>Assigned API base URL</label>
            <CopyValue
              value={`${config?.publicApiUrl || process.env.API_URL || "https://api.somiti.page"}/${key.upstreamProvider === "claude-n-codex" ? "v2" : "v1"}`}
            />
            <div className="actions">
              <ActionButton action="key.rotate" data={{ id }} danger>
                Regenerate API key
              </ActionButton>
              <ActionButton
                action={key.status === "ACTIVE" ? "key.disable" : "key.enable"}
                data={{ id }}
              >
                {key.status === "ACTIVE" ? "Disable key" : "Enable key"}
              </ActionButton>
              <ActionButton action="key.archive" data={{ id }} danger>
                Delete key
              </ActionButton>
            </div>
          </section>
          <div className="grid-two">
            <section className="panel">
              <h2>Customer dashboard</h2>
              <p className="muted">
                A separate read-only link for this customer.
              </p>
              {share?.enabled && (
                <CopyValue
                  value={`${process.env.APP_URL}/dashboard/${decrypt(share.encryptedToken)}`}
                />
              )}
              <div className="actions">
                <ActionButton action="key.share" data={{ id }}>
                  {share ? "Regenerate link" : "Create dashboard link"}
                </ActionButton>
                {share?.enabled && (
                  <ActionButton action="key.unshare" data={{ id }} danger>
                    Disable link
                  </ActionButton>
                )}
              </div>
              <ShareExpiry id={id} />
            </section>
          </div>
          <h2>Key settings</h2>
          <section className="panel">
            <h2>Allowed models</h2>
            <DataTable
              headers={["Model", "Public ID", "Family"]}
              rows={allowed.map((m) => [
                m.displayName,
                m.publicModelId,
                m.family,
              ])}
            />
          </section>
          <KeyForm
            id={id}
            models={all}
            initial={{
              name: key.name,
              upstreamProvider: key.upstreamProvider,
              hasUpstreamKey: Boolean(key.encryptedUpstreamKey),
              modelAccessMode: key.modelAccessMode,
              rateLimitPerMinute: key.rateLimitPerMinute,
              allowedIps: key.allowedIps,
              expiresAt: key.expiresAt?.toISOString().slice(0, 16) || "",
              modelIds: selected.map((s) => s.modelId),
            }}
          />
          <section className="panel">
            <h2>Daily requests</h2>
            <Chart daily={data.daily} field="requests" />
          </section>
          <section className="panel">
            <h2>Request history</h2>
            <LogTable logs={keyLogs} />
            <Pagination
              page={page}
              more={keyLogs.length === 25}
              base={`/dashboard/keys/${id}`}
            />
          </section>
        </>
      );
    } else {
      const keys = await db()
        .select({
          ...getTableColumns(apiKeys),
          requests: sql<string>`(select count(*) from api_requests where api_requests.api_key_id = ${apiKeys.id})`,
        })
        .from(apiKeys)
        .where(and(ownerWhere, isNull(apiKeys.deletedAt)))
        .orderBy(desc(apiKeys.createdAt))
        .limit(25)
        .offset((page - 1) * 25);
      const quotas = await Promise.all(keys.map((key) => keyQuota(key)));
      content = (
        <>
          <Heading
            title="API keys"
            text="Manage customer access, credit, and permissions."
          >
            <Button asChild>
              <Link href="/dashboard/keys/new">
                <Plus size={16} />
                Create API key
              </Link>
            </Button>
          </Heading>
          <section className="panel">
            <DataTable
              headers={[
                "Name",
                "Credential",
                "Model access",
                "API route",
                "Credit left / total",
                "Requests",
                "Rate limit",
                "Expiration",
                "Status",
              ]}
              rows={keys.map((k, index) => [
                <Link key="name" href={`/dashboard/keys/${k.id}`}>
                  {k.name}
                </Link>,
                `${k.keyPrefix}…`,
                k.modelAccessMode.replaceAll("_", " "),
                k.upstreamProvider === "mwapi"
                  ? "API v1"
                  : k.upstreamProvider === "claude-n-codex"
                    ? "API v2"
                    : "Needs setup",
                <span
                  key="credit"
                  className="key-credit"
                  title="Live quota from the assigned API key"
                >
                  {quotas[index].remaining !== null &&
                  quotas[index].allocated !== null ? (
                    <>
                      <strong>{usd(quotas[index].remaining)}</strong>
                      <span> of {usd(quotas[index].allocated)}</span>
                    </>
                  ) : (
                    <span className="muted">Unavailable</span>
                  )}
                </span>,
                k.requests,
                "Upstream managed",
                k.expiresAt?.toISOString().slice(0, 10) || "Never",
                <Badge key="status" value={k.status} />,
              ])}
            />
            <Pagination
              page={page}
              more={keys.length === 25}
              base="/dashboard/keys"
            />
          </section>
        </>
      );
    }
  } else if (section === "models") {
    const selectedProvider =
      search.provider === "claude-n-codex" ? "claude-n-codex" : "mwapi";
    if (!admin) {
      content = (
        <>
          <Heading
            title="Model catalog"
            text="Models configured by your administrator."
          />
          <DataTable
            headers={["Name", "Public ID", "Family"]}
            rows={(
              await db()
                .select()
                .from(models)
                .where(and(eq(models.enabled, true), eq(models.visible, true)))
            ).map((m) => [m.displayName, m.publicModelId, m.family])}
          />
        </>
      );
    } else if (id) {
      requireAdmin(user);
      const [model] =
        id === "new"
          ? []
          : await db().select().from(models).where(eq(models.id, id));
      if (id !== "new" && !model) notFound();
      const aliases = model
        ? await db()
            .select()
            .from(modelAliases)
            .where(eq(modelAliases.modelId, id))
        : [];
      const stats = model
        ? await usage(and(ownerWhere, eq(apiRequests.modelId, id))!)
        : null;
      content = (
        <>
          <Heading
            title={model ? model.displayName : "Add model"}
            text="Public IDs stay stable while you control routing and pricing."
          />
          {stats && (
            <div className="metrics">
              <Metric label="Requests" value={stats.stats.requests} />
              <Metric label="Requests today" value={stats.stats.today} />
              <Metric label="Input tokens" value={stats.stats.inputTokens} />
              <Metric label="Output tokens" value={stats.stats.outputTokens} />
              <Metric
                label="Average latency"
                value={`${stats.stats.averageLatency} ms`}
              />
              <Metric label="Failed requests" value={stats.stats.errors} />
              <Metric label="Revenue" value={usd(stats.stats.spend)} />
              <Metric label="Upstream cost" value={usd(stats.stats.upstream)} />
              <Metric
                label="Estimated profit"
                value={usd(stats.stats.profit)}
              />
            </div>
          )}
          <ModelForm
            initial={
              model
                ? {
                    ...model,
                    createdAt: model.createdAt.toISOString(),
                    updatedAt: model.updatedAt.toISOString(),
                    archivedAt: model.archivedAt?.toISOString() || null,
                    aliases: aliases.map((a) => a.alias).join(", "),
                  }
                : {
                    provider: selectedProvider,
                    family: search.family === "OPENAI" ? "OPENAI" : "CLAUDE",
                    upstreamModelId: search.upstream || "",
                    displayName: search.name || "",
                    enabled: false,
                  }
            }
            duplicate={search.duplicate === "1"}
          />
          {model && (
            <div className="actions">
              <Button asChild variant="secondary">
                <Link href={`/dashboard/models/${id}?duplicate=1`}>
                  Duplicate model
                </Link>
              </Button>
              <ActionButton
                action={model.enabled ? "model.disable" : "model.enable"}
                data={{ id }}
              >
                {model.enabled ? "Disable" : "Enable"}
              </ActionButton>
              <ActionButton action="model.archive" data={{ id }} danger>
                Archive model
              </ActionButton>
            </div>
          )}
        </>
      );
    } else {
      const tab = search.tab || "all";
      const filter =
        tab === "disabled"
          ? and(eq(models.enabled, false), isNull(models.archivedAt))
          : tab === "archived"
            ? sql`${models.archivedAt} IS NOT NULL`
            : and(
                isNull(models.archivedAt),
                ["CLAUDE", "OPENAI"].includes(tab)
                  ? eq(models.family, tab)
                  : undefined,
              );
      const list = await db()
        .select()
        .from(models)
        .where(and(filter, eq(models.provider, selectedProvider)))
        .orderBy(models.sortOrder)
        .limit(25)
        .offset((page - 1) * 25);
      content = (
        <>
          <Heading
            title="Model catalog"
            text="Your models. Your pricing. One consistent API."
          >
            <Button asChild>
              <Link href={`/dashboard/models/new?provider=${selectedProvider}`}>
                <Plus size={16} />
                Add model
              </Link>
            </Button>
          </Heading>
          <ProviderSelector provider={selectedProvider} />
          <ProviderGuide provider={selectedProvider} />
          <ProviderDiscovery
            key={selectedProvider}
            provider={selectedProvider}
          />
          <h2>Configured Somiti models</h2>
          <div className="tabs">
            {[
              ["all", "All models"],
              ["CLAUDE", "Claude"],
              ["OPENAI", "ChatGPT / OpenAI"],
              ["disabled", "Disabled"],
              ["archived", "Archived"],
            ].map(([value, label]) => (
              <Link
                key={value}
                className={tab === value ? "active" : ""}
                href={`/dashboard/models?provider=${selectedProvider}&tab=${value}`}
              >
                {label}
              </Link>
            ))}
          </div>
          <section className="panel">
            <DataTable
              headers={[
                "Model",
                "Public ID",
                "Family",
                "Input / 1M",
                "Provider",
                "Output / 1M",
                "Endpoints",
                "Status",
              ]}
              rows={list.map((m) => [
                <Link key="name" href={`/dashboard/models/${m.id}`}>
                  {m.displayName}
                </Link>,
                m.publicModelId,
                m.family,
                usd(prices(m).input, 4),
                m.provider,
                usd(prices(m).output, 4),
                [
                  m.supportsOpenaiEndpoint && "OpenAI",
                  m.supportsAnthropicEndpoint && "Anthropic",
                ]
                  .filter(Boolean)
                  .join(", "),
                <Badge key="s" value={m.enabled ? "Enabled" : "Disabled"} />,
              ])}
            />
            <Pagination
              page={page}
              more={list.length === 25}
              base={`/dashboard/models?provider=${selectedProvider}&tab=${tab}`}
            />
          </section>
        </>
      );
    }
  } else if (section === "logs") {
    const filters: SQL[] = [];
    if (search.key && /^[0-9a-f-]{36}$/.test(search.key))
      filters.push(eq(apiRequests.apiKeyId, search.key));
    if (search.model)
      filters.push(eq(apiRequests.publicModelIdSnapshot, search.model));
    if (search.family)
      filters.push(eq(apiRequests.modelFamilySnapshot, search.family));
    if (search.status) filters.push(eq(apiRequests.status, search.status));
    if (search.endpoint)
      filters.push(eq(apiRequests.endpoint, search.endpoint));
    if (search.from && !isNaN(Date.parse(search.from)))
      filters.push(gte(apiRequests.createdAt, new Date(search.from)));
    if (search.to && !isNaN(Date.parse(search.to)))
      filters.push(
        lte(apiRequests.createdAt, new Date(`${search.to}T23:59:59.999Z`)),
      );
    const logs = await requestLogs(ownerWhere, page, and(...filters));
    const query = new URLSearchParams(
      Object.entries(search).filter(([k, v]) => k !== "page" && v) as [
        string,
        string,
      ][],
    ).toString();
    content = (
      <>
        <Heading
          title="Request logs"
          text="Request metadata with immutable billing history. No prompts or responses stored."
        />
        <form className="panel form-grid" method="get">
          {[
            ["key", "API key ID"],
            ["model", "Public model ID"],
            ["family", "Family"],
            ["endpoint", "Endpoint"],
            ["status", "Status"],
            ["from", "From date"],
            ["to", "To date"],
          ].map(([name, label]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                defaultValue={search[name]}
                type={["from", "to"].includes(name) ? "date" : "text"}
              />
            </label>
          ))}
          <div>
            <Button>Apply filters</Button>
          </div>
        </form>
        <section className="panel">
          <LogTable logs={logs} />
          <Pagination
            page={page}
            more={logs.length === 25}
            base={`/dashboard/logs?${query}`}
          />
        </section>
      </>
    );
  } else if (section === "transactions") {
    const rows = await db()
      .select({ t: balanceTransactions })
      .from(balanceTransactions)
      .leftJoin(wallets, eq(balanceTransactions.walletId, wallets.id))
      .leftJoin(apiKeys, eq(balanceTransactions.apiKeyId, apiKeys.id))
      .where(
        sql`(${wallets.userId} = ${user.id} OR ${apiKeys.ownerUserId} = ${user.id})`,
      )
      .orderBy(desc(balanceTransactions.createdAt))
      .limit(25)
      .offset((page - 1) * 25);
    content = (
      <>
        <Heading
          title="Transactions"
          text="An auditable record of every credit movement."
        />
        <section className="panel">
          <DataTable
            headers={[
              "Date",
              "Type",
              "Amount",
              "Before",
              "After",
              "Description",
              "Reference",
            ]}
            rows={rows.map(({ t }) => [
              t.createdAt.toISOString(),
              t.type,
              usd(t.amount, 8),
              usd(t.balanceBefore, 8),
              usd(t.balanceAfter, 8),
              t.description,
              t.referenceId || "—",
            ])}
          />
          <Pagination
            page={page}
            more={rows.length === 25}
            base="/dashboard/transactions"
          />
        </section>
      </>
    );
  } else if (section === "audit") {
    const rows = await db()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, user.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(25)
      .offset((page - 1) * 25);
    content = (
      <>
        <Heading
          title="Audit logs"
          text="Security and configuration changes across your workspace."
        />
        <section className="panel">
          <DataTable
            headers={["Date", "Action", "Entity", "Entity ID"]}
            rows={rows.map((r) => [
              r.createdAt.toISOString(),
              r.action,
              r.entityType,
              r.entityId,
            ])}
          />
          <Pagination
            page={page}
            more={rows.length === 25}
            base="/dashboard/audit"
          />
        </section>
      </>
    );
  } else if (section === "settings") {
    content = (
      <>
        <Heading
          title="Workspace settings"
          text="Branding, API configuration, and security."
        />
        {admin && (
          <SettingsForm
            initial={{
              applicationName: config?.applicationName || "Somiti API",
              publicApiUrl:
                config?.publicApiUrl ||
                process.env.API_URL ||
                "https://api.somiti.page",
              defaultRateLimit: config?.defaultRateLimit || 60,
            }}
          />
        )}
        <section className="panel">
          <h2>Security & provider status</h2>
          <DataTable
            headers={["Setting", "Status"]}
            rows={[
              ["Currency", "USD"],
              ["MWAPI", providerConfigured() ? "Configured" : "Not configured"],
              [
                "claude-n-codex.com / Claude",
                configured("CLAUDE_N_CODEX", undefined, "CLAUDE")
                  ? "Configured"
                  : "Not configured",
              ],
              [
                "claude-n-codex.com / ChatGPT",
                configured("CLAUDE_N_CODEX", undefined, "OPENAI")
                  ? "Configured"
                  : "Not configured",
              ],
              [
                "Two-factor authentication",
                user.totpSecret
                  ? "Enabled"
                  : "Not configured — use npm run owner:totp",
              ],
              ["Session duration", "12 hours"],
              ["Customer prompt logging", "Off"],
              [
                "Credential storage",
                "AES-256-GCM encrypted; HMAC authentication",
              ],
            ]}
          />
        </section>
      </>
    );
  } else notFound();
  return (
    <Shell
      section={section}
      name={user.name}
      email={user.email}
      appName={config?.applicationName}
    >
      {content}
    </Shell>
  );
}
export function PeriodTabs({ base, period }: { base: string; period: string }) {
  return (
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
          href={`${base}?period=${v}`}
        >
          {l}
        </Link>
      ))}
    </div>
  );
}
export function LogTable({
  logs,
}: {
  logs: Awaited<ReturnType<typeof requestLogs>>;
}) {
  return (
    <DataTable
      headers={[
        "Time (UTC)",
        "Request ID",
        "API key",
        "Model",
        "Endpoint",
        "Input",
        "Output",
        "Total",
        "Cost",
        "Estimated profit",
        "Latency",
        "Status",
        "Usage",
      ]}
      rows={logs.map((l) => [
        l.created.toISOString().replace("T", " ").slice(0, 19),
        l.id,
        l.key,
        l.model,
        l.endpoint,
        l.input ?? "—",
        l.output ?? "—",
        l.total ?? "—",
        usd(l.cost, 8),
        usd(l.profit, 8),
        `${l.latency ?? "—"} ms`,
        <Badge key="s" value={l.status} />,
        l.usage,
      ])}
    />
  );
}
import { ShareExpiry } from "@/components/share-expiry";
