import { readJson } from "@/lib/security/request-body";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { verifyTotp } from "@/lib/security/totp";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { sameOrigin, sessionCookie } from "@/lib/auth";
import { decrypt, hash, secret } from "@/lib/security/secrets";
import { AppError, errorResponse } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { requestIp } from "@/lib/security/ip";
export async function POST(req: Request) {
  let stage = "origin_check";
  try {
    sameOrigin(req);
    stage = "request_validation";
    const data = z
      .object({
        username: z.string().trim().min(3).max(254).optional(),
        email: z.email().optional(),
        password: z.string().min(1).max(200),
        totp: z.string().optional(),
      })
      .parse(await readJson(req));
    const identifier = (data.username || data.email || "").toLowerCase();
    if (!identifier)
      throw new AppError("invalid_request", "Username is required.");
    stage = "database_rate_limit";
    await rateLimit(`login-ip:${requestIp(req.headers) || "unknown"}`, 30);
    stage = "auth_secret_and_identity_rate_limit";
    await rateLimit(`login-identity:${hash(identifier)}`, 8);
    stage = "user_lookup";
    const [user] = await db()
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.username, identifier)));
    stage = "password_verification";
    const valid = await bcrypt.compare(
      data.password,
      user?.passwordHash ||
        "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
    );
    stage = "totp_decryption_and_verification";
    if (
      !user ||
      !valid ||
      (["OWNER", "ADMIN"].includes(user.role) && !user.totpSecret) ||
      (user.totpSecret &&
        !verifyTotp(decrypt(user.totpSecret), data.totp || ""))
    )
      throw new AppError(
        "invalid_credentials",
        "Invalid username, password, or 2FA code. Administrators must enroll an authenticator before signing in.",
        401,
      );
    stage = "session_creation";
    const token = secret("session_");
    const expires = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await db()
      .insert(sessions)
      .values({ userId: user.id, tokenHash: hash(token), expiresAt: expires });
    stage = "session_cookie";
    (await cookies()).set(sessionCookie, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires,
    });
    return Response.json({ ok: true });
  } catch (e) {
    // Never log exception text: database errors can contain SQL and credentials.
    if (!(e instanceof AppError) && !(e instanceof z.ZodError)) {
      console.error("somiti_login_failure", { stage });
    }
    return errorResponse(e);
  }
}
