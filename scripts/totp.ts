import { generateSecret, generateURI, verifySync } from "otplib";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { users, sessions } from "../src/lib/db/schema";
import { encrypt } from "../src/lib/security/secrets";
const email = process.env.OWNER_EMAIL?.toLowerCase();
if (!email) throw new Error("OWNER_EMAIL required");
const [user] = await db().select().from(users).where(eq(users.email, email));
if (!user) throw new Error("Owner not found");
const secret = process.env.TOTP_SETUP_SECRET;
if (!secret) {
  const value = generateSecret();
  console.log(
    "Store this secret in your authenticator, then rerun with TOTP_SETUP_SECRET and TOTP_CODE to confirm.",
  );
  console.log(
    generateURI({ issuer: "Somiti API", label: email, secret: value }),
  );
} else {
  if (!verifySync({ secret, token: process.env.TOTP_CODE || "" }).valid)
    throw new Error("Invalid verification code");
  await db().transaction(async (tx) => {
    await tx
      .update(users)
      .set({ totpSecret: encrypt(secret) })
      .where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
  });
  console.log("Two-factor authentication enabled. Existing sessions revoked.");
}
process.exit(0);
