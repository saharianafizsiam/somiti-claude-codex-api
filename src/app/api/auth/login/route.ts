import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { verifySync } from "otplib";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { sameOrigin, sessionCookie } from "@/lib/auth";
import { decrypt, hash, secret } from "@/lib/security/secrets";
import { AppError, errorResponse } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { requestIp } from "@/lib/security/ip";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const data = z
      .object({
        username: z.string().trim().min(3).max(254).optional(),
        email: z.email().optional(),
        password: z.string().min(1).max(200),
        totp: z.string().optional(),
      })
      .parse(await req.json());
    const identifier = (data.username || data.email || "").toLowerCase();
    if (!identifier)
      throw new AppError("invalid_request", "Username is required.");
    await rateLimit(`login-ip:${requestIp(req.headers) || "unknown"}`, 30);
    await rateLimit(`login-identity:${hash(identifier)}`, 8);
    const [user] = await db()
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.username, identifier)));
    const valid = await bcrypt.compare(
      data.password,
      user?.passwordHash ||
        "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
    );
    if (
      !user ||
      !valid ||
      (["OWNER", "ADMIN"].includes(user.role) && !user.totpSecret) ||
      (user.totpSecret &&
        (!/^\d{6}$/.test(data.totp || "") ||
          !verifySync({
            secret: decrypt(user.totpSecret),
            token: data.totp || "",
          }).valid))
    )
      throw new AppError(
        "invalid_credentials",
        "Invalid username, password, or 2FA code. Administrators must enroll an authenticator before signing in.",
        401,
      );
    const token = secret("session_");
    const expires = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await db()
      .insert(sessions)
      .values({ userId: user.id, tokenHash: hash(token), expiresAt: expires });
    (await cookies()).set(sessionCookie, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
