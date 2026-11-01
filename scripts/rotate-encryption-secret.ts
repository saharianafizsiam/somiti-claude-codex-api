import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import postgres from "postgres";

type EncryptedRow = {
  id: string;
  value: string;
  extra?: string | null;
};

const keyPattern = /^[a-f0-9]{64}$/i;

function keyFrom(name: string) {
  const value = process.env[name];
  if (!value || !keyPattern.test(value)) {
    throw new Error(`${name} must contain exactly 64 hexadecimal characters.`);
  }
  return Buffer.from(value, "hex");
}

function decrypt(value: string, key: Buffer) {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted value format.");
  const [iv, tag, body] = parts.map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

function encrypt(value: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body]
    .map((part) => part.toString("base64url"))
    .join(".");
}

function assertRequiredEnvironment() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const oldKey = keyFrom("OLD_API_KEY_ENCRYPTION_SECRET");
  const newKey = keyFrom("NEW_API_KEY_ENCRYPTION_SECRET");
  if (oldKey.equals(newKey)) {
    throw new Error("The old and new encryption secrets must be different.");
  }
  return { oldKey, newKey };
}

const dryRun = process.argv.includes("--dry-run");
const { oldKey, newKey } = assertRequiredEnvironment();
const client = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

try {
  const summary = await client.begin(async (tx) => {
    await tx`LOCK TABLE users, api_keys, dashboard_shares, canva_codes IN SHARE ROW EXCLUSIVE MODE`;

    const [users, apiKeys, shares, canvaCodes] = await Promise.all([
      tx<EncryptedRow[]>`SELECT id, totp_secret AS value FROM users WHERE totp_secret IS NOT NULL`,
      tx<EncryptedRow[]>`SELECT id, encrypted_key AS value, encrypted_upstream_key AS extra FROM api_keys`,
      tx<EncryptedRow[]>`SELECT id, encrypted_token AS value FROM dashboard_shares`,
      tx<EncryptedRow[]>`SELECT id, encrypted_code AS value FROM canva_codes`,
    ]);

    const reencrypt = (rows: EncryptedRow[], label: string) =>
      rows.map((row) => {
        try {
          return {
            id: row.id,
            value: encrypt(decrypt(row.value, oldKey), newKey),
            extra:
              row.extra == null
                ? null
                : encrypt(decrypt(row.extra, oldKey), newKey),
          };
        } catch {
          throw new Error(
            `Could not decrypt a ${label} record. Check OLD_API_KEY_ENCRYPTION_SECRET; no database changes were committed.`,
          );
        }
      });

    const updates = {
      users: reencrypt(users, "user"),
      apiKeys: reencrypt(apiKeys, "API key"),
      shares: reencrypt(shares, "dashboard share"),
      canvaCodes: reencrypt(canvaCodes, "Canva code"),
    };

    if (!dryRun) {
      for (const row of updates.users) {
        await tx`UPDATE users SET totp_secret = ${row.value}, updated_at = NOW() WHERE id = ${row.id}`;
      }
      for (const row of updates.apiKeys) {
        await tx`UPDATE api_keys SET encrypted_key = ${row.value}, encrypted_upstream_key = ${row.extra}, updated_at = NOW() WHERE id = ${row.id}`;
      }
      for (const row of updates.shares) {
        await tx`UPDATE dashboard_shares SET encrypted_token = ${row.value} WHERE id = ${row.id}`;
      }
      for (const row of updates.canvaCodes) {
        await tx`UPDATE canva_codes SET encrypted_code = ${row.value} WHERE id = ${row.id}`;
      }
    }

    return {
      users: updates.users.length,
      apiKeys: updates.apiKeys.length,
      dashboardShares: updates.shares.length,
      canvaCodes: updates.canvaCodes.length,
    };
  });

  console.log(
    `${dryRun ? "Verified" : "Rotated"} encrypted records: ${summary.users} user 2FA secret(s), ${summary.apiKeys} API key record(s), ${summary.dashboardShares} dashboard share(s), ${summary.canvaCodes} Canva code(s).`,
  );
} finally {
  await client.end();
}
