import { sharedKey } from "@/lib/api-keys";
import { decrypt } from "@/lib/security/secrets";
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const key = await sharedKey((await ctx.params).token);
  if (!key) return new Response(null, { status: 404 });
  return Response.json(
    { apiKey: decrypt(key.encryptedKey) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
