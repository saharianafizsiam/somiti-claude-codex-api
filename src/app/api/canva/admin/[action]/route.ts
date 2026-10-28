import { sameOrigin } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { readJson } from "@/lib/security/request-body";
import { canvaAction } from "@/server/canva";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ action: string }> },
) {
  try {
    sameOrigin(req);
    return Response.json(
      await canvaAction((await ctx.params).action, await readJson(req, 4096)),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
