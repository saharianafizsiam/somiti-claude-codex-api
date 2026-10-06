import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { hash } from "@/lib/security/secrets";
import { sameOrigin, sessionCookie } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const jar = await cookies();
    const token = jar.get(sessionCookie)?.value;
    if (token)
      await db()
        .delete(sessions)
        .where(eq(sessions.tokenHash, hash(token)));
    jar.delete(sessionCookie);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
