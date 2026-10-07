import { AppError } from "../errors";
/** Bound streamed bodies as they arrive, including chunked requests without Content-Length. */
export async function readJson(
  req: Pick<Request, "body" | "headers">,
  limit = 65536,
): Promise<unknown> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit)
    throw new AppError("invalid_request", "Request body is too large.", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new AppError("invalid_request", "JSON body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AppError(
          "invalid_request",
          "Request body is too large.",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("invalid_request", "Invalid JSON.");
  }
}
