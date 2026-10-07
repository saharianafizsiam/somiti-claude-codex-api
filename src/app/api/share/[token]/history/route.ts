import { customerCatalog } from "@/lib/models/customer-id";
import { accountHistory } from "@/lib/providers/account";
import { availableModels, sharedKey } from "@/lib/api-keys";
import { apiRequests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requestLogs } from "@/server/queries";
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const key = await sharedKey((await ctx.params).token);
  if (!key) return new Response(null, { status: 404 });
  const search = new URL(req.url).searchParams;
  const page = Math.max(1, Math.min(100000, Number.parseInt(search.get("page") || "1") || 1));
  if(key.upstreamProvider === "claude-n-codex") {
    const history = await accountHistory(key,customerCatalog(await availableModels(key)),page);
    return Response.json(history ?? {error:"Account history is temporarily unavailable."},{status:history?200:503,headers:{"Cache-Control":"private, no-store"}});
  }
  const model = (search.get("model") || "").slice(0,150);
  const rows = await requestLogs(eq(apiRequests.apiKeyId,key.id),page,model ? eq(apiRequests.publicModelIdSnapshot,model) : undefined);
  return Response.json({ logs: rows.map(l => ({ id:l.id,model:l.model,input:l.input,output:l.output,latency:l.latency,status:l.status,created:l.created.toISOString() })) }, { headers: { "Cache-Control":"private, no-store" } });
}
