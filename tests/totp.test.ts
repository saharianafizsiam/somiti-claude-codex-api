import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyTotp } from "../src/lib/security/totp";

// RFC 6238 SHA-1 test secret, with independently computed six-digit tokens.
const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
function tokenAt(epoch: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(epoch / 30)));
  const digest = createHmac("sha1", "12345678901234567890")
    .update(counter)
    .digest();
  const offset = digest[19] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
describe("Authenticator compatibility", () => {
  it("matches independent SHA-1 TOTP and the RFC vector", () => {
    expect(tokenAt(59)).toBe("287082");
    expect(verifyTotp(secret, "287082", 59)).toBe(true);
  });
  it("accepts spaced codes and the adjacent time steps", () => {
    const now = 1234567890;
    const token = tokenAt(now);
    expect(
      verifyTotp(secret, `${token.slice(0, 3)} ${token.slice(3)}`, now),
    ).toBe(true);
    expect(verifyTotp(secret, tokenAt(now - 30), now)).toBe(true);
    expect(verifyTotp(secret, tokenAt(now + 30), now)).toBe(true);
    expect(verifyTotp(secret, tokenAt(now - 90), now)).toBe(false);
  });
  it("rejects malformed codes and wrong secrets", () => {
    expect(verifyTotp(secret, "12345", 59)).toBe(false);
    expect(verifyTotp("INVALID!", "287082", 59)).toBe(false);
    expect(verifyTotp("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", "287082", 59)).toBe(
      false,
    );
  });
});
