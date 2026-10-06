import { sql } from "drizzle-orm";
import { db } from "../db";
import { AppError } from "../errors";
export async function rateLimit(subject: string, limit: number) {
  const minute = Math.floor(Date.now() / 60000);
  const result = await db().execute(
    sql`INSERT INTO rate_buckets (id, count, expires_at) VALUES (${`${subject}:${minute}`}, 1, now() + interval '2 minutes') ON CONFLICT (id) DO UPDATE SET count = rate_buckets.count + 1 RETURNING count`,
  );
  if (Number(result[0].count) > limit)
    throw new AppError("rate_limit_exceeded", "Rate limit exceeded.", 429);
}
