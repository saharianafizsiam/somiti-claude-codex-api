import postgres from "postgres";
import { decrypt } from "../src/lib/security/secrets";

let failed = false;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
  if (!ok) failed = true;
}
check("DATABASE_URL configured", Boolean(process.env.DATABASE_URL));
check(
  "AUTH_SECRET has at least 32 characters",
  (process.env.AUTH_SECRET?.length || 0) >= 32,
);
check(
  "API_KEY_ENCRYPTION_SECRET is 64 hex characters",
  /^[a-f0-9]{64}$/i.test(process.env.API_KEY_ENCRYPTION_SECRET || ""),
);
for (const name of ["APP_URL", "API_URL"]) {
  let valid = false;
  try {
    const url = new URL(process.env[name] || "");
    valid = url.protocol === "https:" && url.origin === process.env[name];
  } catch {
    /* Only report validity, never environment values. */
  }
  check(`${name} is an HTTPS origin without a trailing slash`, valid);
}
if (process.env.DATABASE_URL) {
  const client = postgres(process.env.DATABASE_URL, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
  });
  let stage = "database connection";
  try {
    await client`SELECT 1`;
    check(stage, true);
    stage = "admin schema and wallet query";
    const admins = await client`SELECT u.password_hash, u.totp_secret,
      EXISTS (SELECT 1 FROM wallets w WHERE w.user_id = u.id) AS wallet_exists,
      u.username = lower(u.username) AND u.email = lower(u.email) AS normalized
      FROM users u WHERE u.role IN ('OWNER', 'ADMIN')`;
    check("At least one admin exists", admins.length > 0);
    for (const [i, admin] of admins.entries()) {
      const label = `Admin ${i + 1}`;
      check(
        `${label}: lowercase username and email`,
        admin.normalized === true,
      );
      check(
        `${label}: bcrypt password format`,
        /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(admin.password_hash),
      );
      check(`${label}: wallet exists`, admin.wallet_exists === true);
      let readable = false;
      try {
        readable = /^[A-Z2-7]+=*$/.test(decrypt(admin.totp_secret || ""));
      } catch {
        /* Secret remains private. */
      }
      check(
        `${label}: authenticator secret decrypts with configured key`,
        readable,
      );
    }
    stage = "session and rate-limit schema";
    await client`SELECT id, token_hash, expires_at FROM sessions LIMIT 0`;
    await client`SELECT * FROM rate_buckets LIMIT 0`;
    check(stage, true);
  } catch {
    check(stage, false);
  } finally {
    await client.end();
  }
}
console.log(
  "Read-only checks finished. No credentials were printed and no database rows were changed. This does not verify a password, live authenticator code, or Vercel environment values.",
);
process.exitCode = failed ? 1 : 0;
