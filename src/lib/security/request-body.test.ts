import { expect, it } from "vitest";
import { readJson } from "./request-body";
it("accepts valid JSON and rejects malformed JSON", async () => {
  const request = (body: string) =>
    new Request("https://example.test", { method: "POST", body });
  expect(await readJson(request('{"value":1}'))).toEqual({ value: 1 });
  await expect(readJson(request("bad"))).rejects.toMatchObject({ status: 400 });
});
it("bounds bodies even when content-length is absent or false", async () => {
  const req = new Request("https://example.test", {
    method: "POST",
    body: '"' + "x".repeat(100) + '"',
    headers: { "content-length": "1" },
  });
  await expect(readJson(req, 32)).rejects.toMatchObject({ status: 413 });
});
