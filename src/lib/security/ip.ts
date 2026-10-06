import { isIP } from "node:net";
export function requestIp(headers: Headers) {
  // Vercel overwrites this header. Never trust forwarding headers on other hosts.
  if (process.env.VERCEL === "1") {
    const ip = headers.get("x-forwarded-for")?.split(",")[0].trim();
    return ip && isIP(ip) ? ip : null;
  }
  return process.env.NODE_ENV === "development" ? "127.0.0.1" : null;
}
