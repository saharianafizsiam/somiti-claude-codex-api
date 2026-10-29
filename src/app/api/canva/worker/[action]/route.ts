import { readJson } from "@/lib/security/request-body";
import { AppError, errorResponse } from "@/lib/errors";
import { db } from "@/lib/db";
import { canvaJobs } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import {
  claimCanvaJob,
  claimCanvaBatch,
  finishCanvaJob,
  secureEqual,
} from "@/server/canva-queue";
export async function POST(
  req: Request,
  context: { params: Promise<{ action: string }> },
) {
  try {
    const secret = process.env.CANVA_WORKER_SECRET;
    if (
      !secret ||
      secret.length < 32 ||
      !secureEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)
    )
      throw new AppError("unauthorized", "Unauthorized.", 401);
    const { action } = await context.params;
    if (action === "status") {
      const [result] = await db().select({ processing: count() }).from(canvaJobs)
        .where(eq(canvaJobs.status, "PROCESSING"));
      return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
    }
    const result =
      action === "claim-batch"
        ? { jobs: await claimCanvaBatch() }
        : action === "claim"
          ? { job: await claimCanvaJob() }
          : action === "finish"
            ? await finishCanvaJob(await readJson(req, 2048))
            : null;
    if (!result) throw new AppError("not_found", "Not found.", 404);
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
