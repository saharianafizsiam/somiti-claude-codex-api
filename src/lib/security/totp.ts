import { verifySync } from "otplib";

// Allow one 30-second step for entry delay and modest clock skew.
export function verifyTotp(secret: string, code: string, epoch?: number) {
  const token = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(token)) return false;
  try {
    return verifySync({
      secret: secret.replace(/\s/g, "").toUpperCase(),
      token,
      epoch,
      epochTolerance: 30,
    }).valid;
  } catch {
    return false;
  }
}
