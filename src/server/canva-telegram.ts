import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { canvaCodes, canvaJobs } from "@/lib/db/schema";

// Telegram copy_text is limited to 256 characters. Individual email addresses
// are validated to 254 characters before being stored in the queue.
export function pendingMessage(rows: { email: string; status: string }[], offset = 0) {
  const emails = rows.map((row) => row.email).join("\n");
  return {
    text: "Canva pending invitations — snapshot\n" +
      rows.map((row, i) => `${offset + i + 1}. ${row.email} (${row.status.toLowerCase()})`).join("\n") +
      "\n\nStatus may change as the worker sends invitations.",
    reply_markup: {
      inline_keyboard: [
        ...rows.map((row, i) => [{ text: `Copy email ${offset + i + 1}`, copy_text: { text: row.email } }]),
        ...(emails.length <= 256 ? [[{ text: "Copy this list", copy_text: { text: emails } }]] : []),
      ],
    },
  };
}

export async function notifyCanvaPending() {
  const token = process.env.CANVA_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.CANVA_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const rows = await db().select({ email: canvaJobs.email, status: canvaJobs.status })
      .from(canvaJobs).innerJoin(canvaCodes, eq(canvaJobs.codeId, canvaCodes.id))
      .where(and(isNull(canvaCodes.deletedAt),
        inArray(canvaCodes.status, ["QUEUED", "PROCESSING", "REVIEW"]),
        inArray(canvaJobs.status, ["QUEUED", "PROCESSING", "REVIEW"])))
      .orderBy(asc(canvaJobs.sequence));
    for (let offset = 0; offset < rows.length; offset += 10) {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, ...pendingMessage(rows.slice(offset, offset + 10), offset) }),
        signal: AbortSignal.timeout(8000),
      });
      const result = await response.json() as { ok?: boolean };
      if (!response.ok || !result.ok) throw new Error("delivery_failed");
    }
  } catch {
    // Never log the request URL, bot token, recipient emails, or Telegram body.
    console.error("canva_telegram_notification_failed");
  }
}
