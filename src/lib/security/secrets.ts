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
export function hash(value: string) {
  const key = process.env.AUTH_SECRET;
  if (!key || key.length < 32)
    throw new Error("AUTH_SECRET must contain at least 32 characters");
  return createHmac("sha256", key).update(value).digest("hex");
}
function encryptionKey() {
  const value = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error(
      "API_KEY_ENCRYPTION_SECRET must be 32 random bytes encoded as hex",
    );
  return Buffer.from(value, "hex");
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function decrypt(value: string) {
  const [iv, tag, body] = value
    .split(".")
    .map((v) => Buffer.from(v, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(body), cipher.final()]).toString("utf8");
}
