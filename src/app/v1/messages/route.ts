import { gateway } from "@/server/gateway";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(req: Request) {
  return gateway(req, "messages");
}
