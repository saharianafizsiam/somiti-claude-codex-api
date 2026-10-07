import { gateway } from "@/server/gateway";
export const runtime = "nodejs";
export const maxDuration = 300;
export function POST(req: Request) {
  return gateway(req, "messages/count_tokens", "claude-n-codex");
}
