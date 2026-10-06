import { authenticate, availableModels } from "@/lib/api-keys";
import { errorResponse } from "@/lib/errors";
export async function GET(req: Request) {
  try {
    const key = await authenticate(req);
    const models = (await availableModels(key)).filter(
      (m) => m.provider === "mwapi",
    );
    return Response.json(
      {
        object: "list",
        data: models.map((m) => ({
          id: m.publicModelId,
          object: "model",
          owned_by: "somiti",
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
