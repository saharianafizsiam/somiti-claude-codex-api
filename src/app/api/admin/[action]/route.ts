import { readJson } from "@/lib/security/request-body";
import { adminAction } from "@/server/admin";
import { sameOrigin } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ action: string }> },
) {
  try {
    sameOrigin(req);
    const { action } = await ctx.params;
    return Response.json(await adminAction(action, await readJson(req)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
