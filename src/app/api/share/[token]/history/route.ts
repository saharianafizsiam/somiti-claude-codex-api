import { customerCatalog } from "@/lib/models/customer-id";
import { filteredAccountHistory } from "@/lib/providers/account";
import { availableModels, sharedKey } from "@/lib/api-keys";
import { apiRequests } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { requestLogs } from "@/server/queries";
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const key = await sharedKey((await ctx.params).token);
  if (!key) return new Response(null, { status: 404 });
  const search = new URL(req.url).searchParams;
  const page = Math.max(1, Math.min(100000, Number.parseInt(search.get("page") || "1") || 1));
  if(key.upstreamProvider === "claude-n-codex") {
    const history = await filteredAccountHistory(key,customerCatalog(await availableModels(key)),page,(search.get("model") || "").slice(0,150));
    return Response.json(history ?? {error:"Account history is temporarily unavailable."},{status:history?200:503,headers:{"Cache-Control":"private, no-store"}});
  }
  const model = (search.get("model") || "").slice(0,150);
  const rows = await requestLogs(eq(apiRequests.apiKeyId,key.id),page,model ? eq(apiRequests.publicModelIdSnapshot,model) : undefined);
  const [used, totals] = await Promise.all([
    db().selectDistinct({model:apiRequests.publicModelIdSnapshot}).from(apiRequests).where(eq(apiRequests.apiKeyId,key.id)),
    db().select({total:count()}).from(apiRequests).where(and(eq(apiRequests.apiKeyId,key.id),model ? eq(apiRequests.publicModelIdSnapshot,model) : undefined)),
  ]);
  return Response.json({ total:totals[0].total, models:used.map(x=>x.model).filter(Boolean).sort(), logs: rows.map(l => ({ id:l.id,model:l.model,input:l.input,output:l.output,latency:l.latency,status:l.status,created:l.created.toISOString() })) }, { headers: { "Cache-Control":"private, no-store" } });
}
