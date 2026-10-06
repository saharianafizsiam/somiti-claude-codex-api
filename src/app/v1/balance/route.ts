import { authenticate } from "@/lib/api-keys";
import { remaining } from "@/lib/billing/money";
import { errorResponse } from "@/lib/errors";
export async function GET(req: Request) {
  try {
    const key = await authenticate(req);
    return Response.json(
      {
        object: "balance",
        currency: "USD",
        allocated: key.allocatedCredit,
        used: key.creditUsed,
        reserved: key.creditReserved,
        remaining: remaining(key),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
