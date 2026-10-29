import { timingSafeEqual, randomUUID } from "node:crypto";
import { and, asc, count, eq, inArray, isNull, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { canvaCodes, canvaJobs, canvaQueueLock } from "@/lib/db/schema";
import { hash } from "@/lib/security/secrets";
import { AppError } from "@/lib/errors";

export function canvaQueueEnabled() {
  return process.env.CANVA_INVITES_ENABLED === "true";
}
function liveCodes() {
  return db()
    .select({ id: canvaCodes.id })
    .from(canvaCodes)
    .where(
      and(isNull(canvaCodes.deletedAt), ne(canvaCodes.status, "CANCELLED")),
    );
}
function token(id: string) {
  return hash(`canva-job:${id}`);
}
export function secureEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
const invitationCode =
  /^(?:\d{16}|CANVA-INVITE-(?:[A-Z0-9]{6}-){4}[A-Z0-9]{6})$/;
const credentials = z.object({
  // Continue accepting the original numeric codes so existing batches remain usable.
  code: z.string().trim().toUpperCase().regex(invitationCode),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
});

// Every queue mutation takes the same database row lock, across all app instances.
export async function locked<T>(
  fn: (
    tx: Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0],
  ) => Promise<T>,
) {
  return db().transaction(async (tx) => {
    await tx.insert(canvaQueueLock).values({ id: 1 }).onConflictDoNothing();
    await tx
      .select()
      .from(canvaQueueLock)
      .where(eq(canvaQueueLock.id, 1))
      .for("update");
    return fn(tx);
  });
}
export async function enqueueCanva(input: unknown) {
  const { code, email } = credentials.parse(input);
  return locked(async (tx) => {
    const [entry] = await tx
      .select()
      .from(canvaCodes)
      .where(
        and(
          eq(canvaCodes.codeHash, hash(`canva:${code}`)),
          isNull(canvaCodes.deletedAt),
        ),
      )
      .for("update");
    if (!entry || (entry.email && entry.email !== email))
      throw new AppError(
        "invalid_code",
        "This code is unavailable for this email address.",
        409,
      );
    const [existing] = await tx
      .select()
      .from(canvaJobs)
      .where(eq(canvaJobs.codeId, entry.id));
    if (existing) return { id: existing.id, token: token(existing.id) };
    if (!canvaQueueEnabled())
      throw new AppError(
        "canva_offline",
        "Invitations are not open yet. Your code has not been used.",
        503,
      );
    if (entry.status !== "UNUSED")
      throw new AppError("invalid_code", "This code is unavailable.", 409);
    await tx
      .update(canvaCodes)
      .set({ email, status: "QUEUED" })
      .where(eq(canvaCodes.id, entry.id));
    const [job] = await tx
      .insert(canvaJobs)
      .values({ codeId: entry.id, email })
      .returning();
    return { id: job.id, token: token(job.id) };
  });
}
export async function canvaQueueStatus(input: unknown) {
  const auth = z
    .object({ id: z.uuid(), token: z.string().max(256) })
    .parse(input);
  if (!secureEqual(token(auth.id), auth.token))
    throw new AppError("not_found", "Invitation not found.", 404);
  // Snapshot position and state together so concurrent completions cannot distort it.
  return locked(async (tx) => {
    const [job] = await tx
      .select()
      .from(canvaJobs)
      .where(eq(canvaJobs.id, auth.id));
    if (!job) throw new AppError("not_found", "Invitation not found.", 404);
    const [code] = await tx
      .select()
      .from(canvaCodes)
      .where(eq(canvaCodes.id, job.codeId));
    if (code.deletedAt || code.status === "CANCELLED")
      return {
        status: "CANCELLED",
        position: null,
        paused: false,
        delayed: false,
      };
    const [ahead] = await tx
      .select({ value: count() })
      .from(canvaJobs)
      .where(
        and(
          lt(canvaJobs.sequence, job.sequence),
          inArray(canvaJobs.status, ["QUEUED", "PROCESSING", "REVIEW"]),
          inArray(canvaJobs.codeId, liveCodes()),
        ),
      );
    const [review] = await tx
      .select()
      .from(canvaJobs)
      .where(
        and(
          inArray(canvaJobs.status, ["PROCESSING", "REVIEW"]),
          inArray(canvaJobs.codeId, liveCodes()),
        ),
      )
      .limit(1);
    const delayed =
      !!review &&
      review.status === "PROCESSING" &&
      !!review.startedAt &&
      Date.now() - review.startedAt.getTime() > 10 * 60_000;
    return {
      status: job.status,
      position: job.status === "QUEUED" ? ahead.value + 1 : null,
      paused: !canvaQueueEnabled() || review?.status === "REVIEW" || delayed,
      delayed: job.status === "PROCESSING" && delayed,
    };
  });
}
export async function claimCanvaJob() {
  if (!canvaQueueEnabled()) return null;
  return locked(async (tx) => {
    const [active] = await tx
      .select()
      .from(canvaJobs)
      .where(
        and(
          inArray(canvaJobs.status, ["PROCESSING", "REVIEW"]),
          inArray(canvaJobs.codeId, liveCodes()),
        ),
      )
      .limit(1);
    // Never retry an uncertain browser action: it may already have sent the invite.
    if (active) return null;
    const [job] = await tx
      .select()
      .from(canvaJobs)
      .where(
        and(
          eq(canvaJobs.status, "QUEUED"),
          inArray(canvaJobs.codeId, liveCodes()),
        ),
      )
      .orderBy(asc(canvaJobs.sequence))
      .limit(1);
    if (!job) return null;
    const claimToken = randomUUID();
    await tx
      .update(canvaJobs)
      .set({ status: "PROCESSING", startedAt: new Date(), claimToken })
      .where(eq(canvaJobs.id, job.id));
    await tx
      .update(canvaCodes)
      .set({ status: "PROCESSING" })
      .where(eq(canvaCodes.id, job.codeId));
    return {
      id: job.id,
      email: job.email,
      claimToken,
      role: "Student" as const,
    };
  });
}
export async function finishCanvaJob(input: unknown) {
  const result = z
    .object({
      id: z.uuid(),
      claimToken: z.uuid(),
      outcome: z.enum(["SENT", "REVIEW"]),
    })
    .parse(input);
  return locked(async (tx) => {
    const [job] = await tx
      .select()
      .from(canvaJobs)
      .where(eq(canvaJobs.id, result.id));
    if (
      !job ||
      !job.claimToken ||
      !secureEqual(job.claimToken, result.claimToken)
    )
      throw new AppError("invalid_claim", "Invalid worker claim.", 409);
    if (job.status === result.outcome) return { ok: true };
    if (job.status !== "PROCESSING")
      throw new AppError("invalid_state", "This invitation needs review.", 409);
    await tx
      .update(canvaJobs)
      .set({ status: result.outcome, finishedAt: new Date() })
      .where(eq(canvaJobs.id, job.id));
    await tx
      .update(canvaCodes)
      .set({
        status: result.outcome,
        ...(result.outcome === "SENT" ? { invitedAt: new Date() } : {}),
      })
      .where(eq(canvaCodes.id, job.codeId));
    return { ok: true };
  });
}
