import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../src/lib/db";
import { users, wallets } from "../src/lib/db/schema";
const email = z.email().parse(process.env.OWNER_EMAIL).toLowerCase();
const password = z.string().min(14).max(72).parse(process.env.OWNER_PASSWORD);
const username = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{3,32}$/)
  .parse(process.env.OWNER_USERNAME)
  .toLowerCase();
await db().transaction(async (tx) => {
  const [user] = await tx
    .insert(users)
    .values({
      email,
      username,
      name: "Workspace owner",
      passwordHash: await bcrypt.hash(password, 12),
      role: "OWNER",
    })
    .returning();
  await tx.insert(wallets).values({ userId: user.id });
});
console.log(
  "Owner created. Enroll an authenticator with npm run owner:totp before signing in. Remove OWNER_PASSWORD from the environment.",
);
process.exit(0);
