import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { after } from "next/server";
import { authenticate, availableModels } from "@/lib/api-keys";
import { db } from "@/lib/db";
import { models, modelAliases } from "@/lib/db/schema";
import { AppError, errorResponse } from "@/lib/errors";
import { reserve, settle } from "@/lib/billing/ledger";
import { provider } from "@/lib/providers";
import { UsageCollector, PublicStream } from "@/lib/providers/sse";
import { requestIp } from "@/lib/security/ip";
import { unavailable, type Endpoint } from "@/lib/providers/types";
const bodySchema = z
  .object({
    model: z.string().min(1).max(200),
    messages: z
      .array(z.object({ role: z.string(), content: z.unknown() }).passthrough())
      .min(1),
    stream: z.boolean().optional().default(false),
    max_tokens: z.number().int().positive().optional(),
    max_completion_tokens: z.number().int().positive().optional(),
  })
  .passthrough();
export async function gateway(
  req: Request,
  endpoint: Endpoint,
  selectedProvider: "mwapi" | "claude-n-codex" = "mwapi",
) {
  const started = Date.now();
  try {
    const key = await authenticate(req);
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 2_000_000)
      throw new AppError("invalid_request", "Request body exceeds 2 MB.", 413);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new AppError("invalid_request", "Invalid JSON.");
    }
    const body = bodySchema.parse(json);
    const [row] = await db()
      .select({ model: models })
      .from(models)
      .leftJoin(modelAliases, eq(modelAliases.modelId, models.id))
      .where(
        or(
          eq(models.publicModelId, body.model),
          eq(modelAliases.alias, body.model),
        ),
      )
      .limit(1);
    if (!row) throw new AppError("model_not_found", "Model not found.", 404);
    const model = row.model;
    if (model.provider !== selectedProvider)
      throw new AppError(
        "model_not_allowed",
        "This model belongs to a different provider. Use its matching API base URL.",
        403,
      );
    if (!model.enabled || model.archivedAt || !model.visible)
      throw new AppError(
        "model_unavailable",
        "This model is currently unavailable.",
        403,
      );
    if (!(await availableModels(key)).some((m) => m.id === model.id))
      throw new AppError(
        "model_not_allowed",
        "This API key does not have access to this model.",
        403,
      );
    if (
      (endpoint === "messages" && !model.supportsAnthropicEndpoint) ||
      (endpoint === "chat/completions" && !model.supportsOpenaiEndpoint)
    )
      throw new AppError(
        "endpoint_not_supported",
        "This model does not support this endpoint.",
      );
    if (body.stream && !model.supportsStreaming)
      throw new AppError(
        "invalid_request",
        "Streaming is not supported for this model.",
      );
    if (body.tools && !model.supportsTools)
      throw new AppError(
        "invalid_request",
        "Tools are not supported for this model.",
      );
    if (body.response_format && !model.supportsStructuredOutput)
      throw new AppError(
        "invalid_request",
        "Structured output is not supported.",
      );
    if (body.n !== undefined && body.n !== 1)
      throw new AppError(
        "invalid_request",
        "Only one completion per request is supported.",
      );
    if ((body.reasoning_effort || body.thinking) && !model.supportsReasoning)
      throw new AppError(
        "invalid_request",
        "Reasoning is not supported for this model.",
      );
    if (
      !model.supportsVision &&
      body.messages.some(
        (m) =>
          Array.isArray(m.content) &&
          m.content.some(
            (v) =>
              v &&
              typeof v === "object" &&
              ["image", "image_url", "input_image"].includes(v.type),
          ),
      )
    )
      throw new AppError(
        "invalid_request",
        "Vision is not supported for this model.",
      );
    const maxOutput =
      body.max_completion_tokens ?? body.max_tokens ?? model.maxOutputTokens;
    if (maxOutput > model.maxOutputTokens)
      throw new AppError(
        "invalid_request",
        "Requested output exceeds model limit.",
      );
    const upstream = provider(model.provider, model.family);
    const reservation = await reserve(
      key.id,
      key.keyHash,
      model,
      endpoint,
      maxOutput,
      requestIp(req.headers),
    );
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 240_000);
    const payload: Record<string, unknown> = {
      ...body,
      model: model.upstreamModelId,
    };
    if (body.max_completion_tokens !== undefined) {
      payload.max_completion_tokens = maxOutput;
      delete payload.max_tokens;
    } else payload.max_tokens = maxOutput;
    if (body.stream && endpoint === "chat/completions")
      payload.stream_options = { include_usage: true };
    let response: Response;
    try {
      response = await upstream.send(endpoint, payload, abort.signal);
    } catch {
      clearTimeout(timeout);
      await settle(
        reservation.requestId,
        unavailable,
        502,
        Date.now() - started,
        "provider_error",
      );
      throw new AppError(
        "provider_error",
        "The upstream provider could not complete the request.",
        502,
      );
    }
    if (!response.ok) {
      clearTimeout(timeout);
      await response.body?.cancel();
      await settle(
        reservation.requestId,
        unavailable,
        response.status,
        Date.now() - started,
        "provider_error",
      );
      throw new AppError(
        "provider_error",
        "The upstream provider rejected the request.",
        502,
      );
    }
    const responseHeaders = {
      "Cache-Control": "no-store",
      "X-Request-Id": reservation.requestId,
    };
    if (!body.stream) {
      try {
        const value = await response.json();
        const usage = upstream.normalizeUsage(value);
        await settle(
          reservation.requestId,
          usage,
          response.status,
          Date.now() - started,
        );
        if (value && typeof value === "object")
          value.model = model.publicModelId;
        return Response.json(value, { headers: responseHeaders });
      } catch {
        await settle(
          reservation.requestId,
          unavailable,
          502,
          Date.now() - started,
          "provider_error",
        );
        throw new AppError("provider_error", "Invalid upstream response.", 502);
      } finally {
        clearTimeout(timeout);
      }
    }
    if (!response.body) {
      clearTimeout(timeout);
      await settle(
        reservation.requestId,
        unavailable,
        502,
        Date.now() - started,
        "provider_error",
      );
      throw new AppError("provider_error", "Missing upstream stream.", 502);
    }
    const reader = response.body.getReader();
    const collector = new UsageCollector();
    const publicStream = new PublicStream(model.publicModelId);
    let disconnected = false;
    let wakeReader: (() => void) | undefined;
    const wake = () => {
      wakeReader?.();
      wakeReader = undefined;
    };
    abort.signal.addEventListener("abort", wake);
    let resolveDone!: () => void;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });
    // Continue consuming final usage after downstream disconnect; Vercel after() extends the lifetime.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        void (async () => {
          let failure: string | undefined;
          try {
            for (;;) {
              while (
                !disconnected &&
                !abort.signal.aborted &&
                (controller.desiredSize ?? 0) <= 0
              )
                await new Promise<void>((resolve) => {
                  wakeReader = resolve;
                });
              if (abort.signal.aborted) throw new Error("Upstream timeout");
              const part = await reader.read();
              if (part.done) break;
              collector.push(part.value);
              const chunk = publicStream.push(part.value);
              if (!disconnected && chunk.length) controller.enqueue(chunk);
            }
          } catch {
            failure = "stream_interrupted";
            if (!disconnected)
              controller.error(new Error("Upstream stream interrupted"));
          } finally {
            clearTimeout(timeout);
            abort.signal.removeEventListener("abort", wake);
            try {
              await settle(
                reservation.requestId,
                collector.usage,
                failure ? 502 : 200,
                Date.now() - started,
                failure,
              );
            } catch {
              if (!disconnected && !failure)
                controller.error(
                  new Error("Settlement failed; request will be recovered."),
                );
              failure = "settlement_failed";
            } finally {
              if (!disconnected && !failure) controller.close();
              resolveDone();
            }
          }
        })();
      },
      pull() {
        wake();
      },
      cancel() {
        disconnected = true;
        wake();
      },
    });
    after(async () => {
      await done;
    });
    return new Response(stream, {
      headers: {
        ...responseHeaders,
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
