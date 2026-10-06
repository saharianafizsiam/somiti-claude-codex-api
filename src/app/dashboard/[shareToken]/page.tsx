import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { availableModels, sharedKey } from "@/lib/api-keys";
import { apiRequests, settings } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { keyQuota } from "@/lib/providers/quota";
import { usage, requestLogs } from "@/server/queries";
import { CustomerConsole } from "@/components/customer-console";
export const dynamic = "force-dynamic";
export default async function Customer({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const key = await sharedKey(shareToken);
  if (!key) notFound();
  const [quota, catalog, { stats }, logs, [config]] = await Promise.all([
    keyQuota(key), availableModels(key), usage(eq(apiRequests.apiKeyId, key.id), "30d"),
    requestLogs(eq(apiRequests.apiKeyId, key.id)), db().select().from(settings).limit(1),
  ]);
  const apiUrl = (config?.publicApiUrl || process.env.API_URL || "https://api.somiti.page").replace(/\/$/, "");
  return <CustomerConsole name={key.name} shareToken={shareToken} prefix={key.keyPrefix}
    status={key.expiresAt && key.expiresAt <= new Date() ? "EXPIRED" : key.status}
    baseUrl={`${apiUrl}/${key.upstreamProvider === "claude-n-codex" ? "v2" : "v1"}`}
    quota={quota} stats={{ requests: Number(stats.requests), errors: Number(stats.errors), today: Number(stats.today), latency: Number(stats.averageLatency), tokens: Number(stats.totalTokens) }}
    models={catalog.map(m => ({ id: m.publicModelId, name: m.displayName, family: m.family, openai: m.supportsOpenaiEndpoint, anthropic: m.supportsAnthropicEndpoint }))}
    logs={logs.map(l => ({ id: l.id, model: l.model, input: l.input, output: l.output, latency: l.latency, status: l.status, created: l.created.toISOString() }))} />;
}
