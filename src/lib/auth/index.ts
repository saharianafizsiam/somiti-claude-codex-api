import { cookies } from "next/headers";
import { and, eq, gt, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "../db";
import { sessions, users } from "../db/schema";
import { hashCandidates } from "../security/secrets";
import { AppError } from "../errors";
export const sessionCookie =
  process.env.NODE_ENV === "production"
    ? "__Host-somiti_session"
    : "somiti_session";
export async function currentUser() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  const [row] = await db()
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        inArray(sessions.tokenHash, hashCandidates(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if(row && ['OWNER','ADMIN'].includes(row.user.role) && !row.user.totpSecret) return null;
  return row?.user ?? null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);
  return user;
}
export async function pageUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
export function requireAdmin(user: { role: string }) {
  if (!["OWNER", "ADMIN"].includes(user.role))
    throw new AppError("forbidden", "Administrator permission required.", 403);
}
export function sameOrigin(req: Request) {
  const expected = new URL(process.env.APP_URL || "http://localhost:3000")
    .origin;
  if (req.headers.get("origin") !== expected)
    throw new AppError("forbidden", "Invalid request origin.", 403);
}
