import { and, eq, gte, inArray, sql, desc, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, apiRequests } from "@/lib/db/schema";
export function periodDate(period: string) {
  if (period === "all") return new Date(0);
  const d = new Date();
  if (period === "today") {
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  d.setUTCDate(d.getUTCDate() - (period === "7d" ? 7 : 30));
  return d;
}
export async function ownerRequestLogs(where: SQL, page = 1, extra?: SQL) {
  const rows = await requestLogs(where, page, extra);
  const amounts = rows.length
    ? await db()
        .select({
          id: apiRequests.requestId,
          profit: apiRequests.estimatedProfit,
        })
        .from(apiRequests)
        .where(
          inArray(
            apiRequests.requestId,
            rows.map((r) => r.id),
          ),
        )
    : [];
  return rows.map((row) => ({
    ...row,
    profit: amounts.find((a) => a.id === row.id)?.profit || "0",
  }));
}
export async function usage(where: SQL, period = "all") {
  const filter = and(where, gte(apiRequests.createdAt, periodDate(period)));
  const [stats] = await db()
    .select({
      requests: sql<string>`count(*)`,
      inputTokens: sql<string>`coalesce(sum(input_tokens),0)`,
      outputTokens: sql<string>`coalesce(sum(output_tokens),0)`,
      totalTokens: sql<string>`coalesce(sum(total_tokens),0)`,
      spend: sql<string>`coalesce(sum(customer_cost),0)::text`,
      upstream: sql<string>`coalesce(sum(upstream_estimated_cost),0)::text`,
      profit: sql<string>`coalesce(sum(estimated_profit),0)::text`,
      averageCost: sql<string>`coalesce(avg(customer_cost),0)::text`,
      averageLatency: sql<string>`coalesce(round(avg(latency_ms)),0)`,
      errors: sql<string>`count(*) filter (where api_requests.status = 'FAILED')`,
      today: sql<string>`count(*) filter (where api_requests.created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`,
      month: sql<string>`count(*) filter (where api_requests.created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`,
    })
    .from(apiRequests)
    .innerJoin(apiKeys, eq(apiRequests.apiKeyId, apiKeys.id))
    .where(filter);
  const daily = await db()
    .select({
      day: sql<string>`to_char(date_trunc('day', api_requests.created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
      spend: sql<string>`sum(customer_cost)::text`,
      requests: sql<string>`count(*)`,
    })
    .from(apiRequests)
    .innerJoin(apiKeys, eq(apiRequests.apiKeyId, apiKeys.id))
    .where(and(filter, gte(apiRequests.createdAt, periodDate("30d"))))
    .groupBy(sql`date_trunc('day', api_requests.created_at AT TIME ZONE 'UTC')`)
    .orderBy(
      sql`date_trunc('day', api_requests.created_at AT TIME ZONE 'UTC')`,
    );
  const byModel = await db()
    .select({
      model: apiRequests.publicModelIdSnapshot,
      family: apiRequests.modelFamilySnapshot,
      requests: sql<string>`count(*)`,
      tokens: sql<string>`coalesce(sum(total_tokens),0)`,
      spend: sql<string>`sum(customer_cost)::text`,
    })
    .from(apiRequests)
    .innerJoin(apiKeys, eq(apiRequests.apiKeyId, apiKeys.id))
    .where(filter)
    .groupBy(apiRequests.publicModelIdSnapshot, apiRequests.modelFamilySnapshot)
    .orderBy(sql`sum(customer_cost) desc`)
    .limit(100);
  return { stats, daily, byModel };
}
export async function requestLogs(where: SQL, page = 1, extra?: SQL) {
  return db()
    .select({
      id: apiRequests.requestId,
      key: apiKeys.name,
      model: apiRequests.publicModelIdSnapshot,
      family: apiRequests.modelFamilySnapshot,
      endpoint: apiRequests.endpoint,
      input: apiRequests.inputTokens,
      output: apiRequests.outputTokens,
      total: apiRequests.totalTokens,
      cost: apiRequests.customerCost,
      latency: apiRequests.latencyMs,
      status: apiRequests.status,
      usage: apiRequests.usageStatus,
      created: apiRequests.createdAt,
    })
    .from(apiRequests)
    .innerJoin(apiKeys, eq(apiRequests.apiKeyId, apiKeys.id))
    .where(and(where, extra))
    .orderBy(desc(apiRequests.createdAt))
    .limit(25)
    .offset((page - 1) * 25);
}
