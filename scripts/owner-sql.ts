import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { mkdir, writeFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { generateSecret } from "otplib";
import { verifyTotp } from "../src/lib/security/totp";
import { z } from "zod";
import { encrypt } from "../src/lib/security/secrets";

// Hidden answers are never printed or included as plaintext in the SQL file.
let hidden = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!hidden) process.stdout.write(chunk);
    callback();
  },
});
const input = createInterface({ input: process.stdin, output, terminal: true });
async function ask(label: string, secret = false) {
  hidden = false;
  const answer = input.question(label);
  hidden = secret;
  try {
    return await answer;
  } finally {
    hidden = false;
    if (secret) process.stdout.write("\n");
  }
}
let stage = "username";
try {
  const username = z
    .string()
    .regex(/^[a-zA-Z0-9_-]{3,32}$/)
    .parse(await ask("Admin username: "))
    .toLowerCase();
  stage = "email";
  const email = z
    .email()
    .parse(await ask("Admin email: "))
    .toLowerCase();
  stage = "password (8-72 characters, at most 72 UTF-8 bytes)";
  const password = z
    .string()
    .min(8)
    .max(72)
    .parse(await ask("Admin password (hidden, 8-72 characters): ", true));
  if (Buffer.byteLength(password, "utf8") > 72)
    throw new Error("Password must be at most 72 UTF-8 bytes.");
  stage = "password confirmation (must match)";
  if (password !== (await ask("Confirm password (hidden): ", true)))
    throw new Error("Passwords do not match.");
  stage = "Vercel encryption key (exactly 64 hex characters)";
  const encryptionKey = await ask(
    "API_KEY_ENCRYPTION_SECRET from Vercel (hidden): ",
    true,
  );
  if (!/^[a-f0-9]{64}$/i.test(encryptionKey))
    throw new Error("Encryption key must contain exactly 64 hex characters.");
  process.env.API_KEY_ENCRYPTION_SECRET = encryptionKey;
  stage = "authenticator verification";
  // Fetch only a public HTTP Date header; no credentials or codes are sent.
  try {
    const response = await fetch("https://www.cloudflare.com", {
      method: "HEAD",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    const remoteTime = Date.parse(response.headers.get("date") || "");
    if (
      Number.isFinite(remoteTime) &&
      Math.abs(Date.now() - remoteTime) > 60000
    ) {
      console.error(
        "Your PC clock differs from the HTTPS server clock by more than a minute. Open Windows Settings > Time & language > Date & time > Sync now, then rerun this helper.",
      );
      throw new Error("Clock mismatch");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Clock mismatch")
      throw error;
    console.log(
      "Online clock check unavailable. Make sure Windows and your phone use automatic time.",
    );
  }
  const totpSecret = generateSecret();
  console.log(
    "\nCreate a NEW Google Authenticator entry using Enter a setup key.",
  );
  console.log(`Account name: Somiti Admin (${username})`);
  console.log(`Setup key: ${totpSecret}`);
  console.log(
    "Type: Time based. Keep this key private; do not send a screenshot of it.",
  );
  console.log(
    "Use the code from this NEW entry below. The old entry will not match.\n",
  );
  while (true) {
    const token = (
      await ask("Current 6-digit authenticator code (hidden): ", true)
    ).replace(/\s/g, "");
    let valid = false;
    try {
      valid = /^\d{6}$/.test(token) && verifyTotp(totpSecret, token);
    } catch {
      /* Report validation failure without printing secret input. */
    }
    if (valid) break;
    console.error(
      `PC time (UTC): ${new Date().toISOString()}. Code contains ${token.length} characters; expected 6 digits.`,
    );
    console.error(
      "2FA did not match. Use the SAME setup secret stored in your authenticator and its newest 6-digit code. Enable automatic time on both your phone and PC. Retry below, or press Ctrl+C to cancel.",
    );
  }
  stage = "SQL generation or file writing";
  const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
  const sql = `-- Private: run once in the initialized SOMITI database in Neon SQL Editor.
-- Existing users are never overwritten. A duplicate username/email rolls back.
BEGIN;
SET LOCAL standard_conforming_strings = on;
WITH new_owner AS (
  INSERT INTO users (username, email, name, password_hash, role, totp_secret)
  VALUES (${quote(username)}, ${quote(email)}, 'Workspace owner', ${quote(await bcrypt.hash(password, 12))}, 'OWNER', ${quote(encrypt(totpSecret))})
  RETURNING id
)
INSERT INTO wallets (user_id) SELECT id FROM new_owner;
COMMIT;
`;
  await mkdir(".tmp", { recursive: true });
  await writeFile(".tmp/neon-owner.sql", sql, { mode: 0o600 });
  console.log(
    "Ready: open .tmp/neon-owner.sql and paste its entire contents into Neon SQL Editor. This helper has not connected to or changed your database.",
  );
} catch {
  console.error(
    `SQL was not generated. Failed at: ${stage}. Check this input and run again.`,
  );
  process.exitCode = 1;
} finally {
  input.close();
}
