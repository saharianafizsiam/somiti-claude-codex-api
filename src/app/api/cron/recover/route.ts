import { recoverStale } from "@/lib/billing/ledger";
import { db } from "@/lib/db";
import { rateBuckets, sessions } from "@/lib/db/schema";
import { lt } from "drizzle-orm";
export async function GET(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return new Response(null, { status: 401 });
  const recovered = await recoverStale();
  await db().delete(rateBuckets).where(lt(rateBuckets.expiresAt, new Date()));
  await db().delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return Response.json({ recovered });
}
