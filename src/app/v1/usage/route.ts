import { authenticate } from "@/lib/api-keys";
import { errorResponse } from "@/lib/errors";
import { usage } from "@/server/queries";
import { apiRequests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
export async function GET(req: Request) {
  try {
    const key = await authenticate(req);
    const period = new URL(req.url).searchParams.get("period") || "all";
    const { stats } = await usage(eq(apiRequests.apiKeyId, key.id), period);
    return Response.json(
      {
        requests: stats.requests,
        input_tokens: stats.inputTokens,
        output_tokens: stats.outputTokens,
        total_tokens: stats.totalTokens,
        spend: stats.spend,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
