import { sameOrigin } from "@/lib/auth";
import { readJson } from "@/lib/security/request-body";
import { requestIp } from "@/lib/security/ip";
import { rateLimit } from "@/lib/rate-limit";
import { hash } from "@/lib/security/secrets";
import { AppError, errorResponse } from "@/lib/errors";
import { enqueueCanva, canvaQueueStatus } from "@/server/canva-queue";
import { after } from "next/server";
import { notifyCanvaPending } from "@/server/canva-telegram";
export async function POST(
  req: Request,
  context: { params: Promise<{ action: string }> },
) {
  try {
    sameOrigin(req);
    const { action } = await context.params;
    if (action !== "enqueue" && action !== "status")
      throw new AppError("not_found", "Not found.", 404);
    await rateLimit(
      `canva:${action}:${hash(requestIp(req.headers) ?? "unknown")}`,
      action === "status" ? 120 : 10,
    );
    const input = await readJson(req, 2048);
    if (action === "enqueue") {
      const { created, ...result } = await enqueueCanva(input);
      if (created) after(() => notifyCanvaPending());
      return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
    }
    return Response.json(
      await canvaQueueStatus(input),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
