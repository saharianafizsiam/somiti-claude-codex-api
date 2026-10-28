import { randomInt } from "node:crypto";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { canvaCodes } from "@/lib/db/schema";
import { requireAdmin, requireUser } from "@/lib/auth";
import { decrypt, encrypt, hash } from "@/lib/security/secrets";
import { audit } from "@/lib/billing/ledger";
import { AppError } from "@/lib/errors";

export function newCanvaCode() {
  // Avoid ambiguous characters such as 0/O and 1/I in codes customers type.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const group = () =>
    Array.from(
      { length: 6 },
      () => alphabet[randomInt(0, alphabet.length)],
    ).join("");
  return `CANVA-INVITE-${Array.from({ length: 5 }, group).join("-")}`;
}
export async function canvaOverview(page = 1) {
  const user = await requireUser();
  requireAdmin(user);
  const where = and(
    eq(canvaCodes.createdBy, user.id),
    isNull(canvaCodes.deletedAt),
  );
  const [totals, rows] = await Promise.all([
    db()
      .select({
        total: count(),
        unused: sql<number>`count(*) filter (where status = 'UNUSED')`,
        sent: sql<number>`count(*) filter (where status = 'SENT')`,
        assigned: sql<number>`count(*) filter (where email is not null)`,
      })
      .from(canvaCodes)
      .where(where),
    db()
      .select()
      .from(canvaCodes)
      .where(where)
      .orderBy(desc(canvaCodes.createdAt), desc(canvaCodes.id))
      .limit(50)
      .offset((page - 1) * 50),
  ]);
  return {
    totals: totals[0],
    page,
    rows: rows.map((r) => ({
      id: r.id,
      code: decrypt(r.encryptedCode),
      email: r.email,
      status: r.status,
      created: r.createdAt.toISOString(),
    })),
  };
}
export async function canvaAction(action: string, input: unknown) {
  const user = await requireUser();
  requireAdmin(user);
  if (action === "generate") {
    const { quantity } = z
      .object({ quantity: z.number().int().min(1).max(1000) })
      .parse(input);
    const codes = new Set<string>();
    while (codes.size < quantity) codes.add(newCanvaCode());
    await db().transaction(async (tx) => {
      await tx
        .insert(canvaCodes)
        .values(
          [...codes].map((code) => ({
            codeHash: hash(`canva:${code}`),
            encryptedCode: encrypt(code),
            createdBy: user.id,
          })),
        );
      await audit(
        tx,
        user.id,
        "CANVA_GENERATE_CODES",
        "canva_batch",
        crypto.randomUUID(),
      );
    });
    return { codes: [...codes] };
  }
  if (action === "delete") {
    const { id } = z.object({ id: z.uuid() }).parse(input);
    await db().transaction(async (tx) => {
      const [deleted] = await tx
        .update(canvaCodes)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(canvaCodes.id, id),
            eq(canvaCodes.createdBy, user.id),
            eq(canvaCodes.status, "UNUSED"),
            isNull(canvaCodes.email),
            isNull(canvaCodes.deletedAt),
          ),
        )
        .returning({ id: canvaCodes.id });
      if (!deleted)
        throw new AppError(
          "code_unavailable",
          "Only unused codes can be deleted.",
          409,
        );
      await audit(tx, user.id, "CANVA_DELETE_CODE", "canva_code", id);
    });
    return { ok: true };
  }
  // Never clear a redeemed code until Canva team access has actually been revoked.
  if (action === "remove")
    throw new AppError(
      "canva_not_connected",
      "Connect Canva membership management before removing access. The code assignment has not changed.",
      503,
    );
  throw new AppError("not_found", "Action not found.", 404);
}
