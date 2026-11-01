import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: vi.fn() }));
import { pendingMessage } from "@/server/canva-telegram";

describe("Canva Telegram pending list", () => {
  it("copies emails on separate lines and preserves queue numbering", () => {
    const message = pendingMessage([
      { email: "one@example.com", status: "QUEUED" },
      { email: "two@example.com", status: "REVIEW" },
    ], 10);
    expect(message.text).toContain("11. one@example.com (queued)");
    expect(message.reply_markup.inline_keyboard.at(-1)?.[0].copy_text.text)
      .toBe("one@example.com\ntwo@example.com");
  });
  it("omits oversized list copy buttons while keeping individual email copies", () => {
    const email = "a".repeat(240) + "@example.com";
    const message = pendingMessage([{ email, status: "QUEUED" }, { email, status: "QUEUED" }]);
    expect(message.reply_markup.inline_keyboard).toHaveLength(2);
    for (const row of message.reply_markup.inline_keyboard)
      expect(row[0].copy_text.text.length).toBeLessThanOrEqual(256);
  });
});
