import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
export function secret(
  prefix: "sk-somiti_" | "sk-myapi_" | "SOMITI-" | "session_",
) {
  return prefix + randomBytes(32).toString("base64url");
}
function authSecrets() {
  const primary = process.env.AUTH_SECRET;
  if (!primary || primary.length < 32)
    throw new Error("AUTH_SECRET must contain at least 32 characters");
  const previous = process.env.AUTH_SECRET_PREVIOUS;
  if (previous && previous.length < 32)
    throw new Error("AUTH_SECRET_PREVIOUS must contain at least 32 characters");
  return previous && previous !== primary ? [primary, previous] : [primary];
}
export function hash(value: string) {
  return createHmac("sha256", authSecrets()[0]).update(value).digest("hex");
}
// During a planned AUTH_SECRET rotation, callers use this for database lookups
// so already-issued credentials stay valid until their normal reissue window.
export function hashCandidates(value: string) {
  return authSecrets().map((key) =>
    createHmac("sha256", key).update(value).digest("hex"),
  );
}
function encryptionKey(value: string | undefined, name: string) {
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error(
      `${name} must be 32 random bytes encoded as hex`,
    );
  return Buffer.from(value, "hex");
}
function encryptionKeys() {
  const primary = encryptionKey(
    process.env.API_KEY_ENCRYPTION_SECRET,
    "API_KEY_ENCRYPTION_SECRET",
  );
  const previousValue = process.env.API_KEY_ENCRYPTION_PREVIOUS_SECRET;
  if (!previousValue) return [primary];
  const previous = encryptionKey(
    previousValue,
    "API_KEY_ENCRYPTION_PREVIOUS_SECRET",
  );
  return previous.equals(primary) ? [primary] : [primary, previous];
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKeys()[0], iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function decrypt(value: string) {
  const [iv, tag, body] = value
    .split(".")
    .map((v) => Buffer.from(v, "base64url"));
  for (const key of encryptionKeys()) {
    try {
      const cipher = createDecipheriv("aes-256-gcm", key, iv);
      cipher.setAuthTag(tag);
      return Buffer.concat([cipher.update(body), cipher.final()]).toString(
        "utf8",
      );
    } catch {
      // The next configured rotation key may decrypt this older record.
    }
  }
  throw new Error("Encrypted value could not be decrypted with the configured keys");
}
