import { authenticate } from "@/lib/api-keys";
import { keyQuota } from "@/lib/providers/quota";
import { errorResponse } from "@/lib/errors";
export async function GET(req: Request) {
  try {
    const key = await authenticate(req);
    return Response.json(
      await keyQuota(key),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
