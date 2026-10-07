import { importedCapabilities } from "@/lib/models/imported-capabilities";
import { customerModelId } from "@/lib/models/customer-id";
import { resolveClientAlias } from "@/lib/models/client-alias";
import { readJson } from "@/lib/security/request-body";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { after } from "next/server";
import { authenticate, availableModels } from "@/lib/api-keys";
import { db } from "@/lib/db";
import { models, modelAliases } from "@/lib/db/schema";
import { AppError, errorResponse } from "@/lib/errors";
import { reserve, settle } from "@/lib/billing/ledger";
import { compatibleProvider } from "@/lib/providers/compatible";
import { decrypt } from "@/lib/security/secrets";
import { UsageCollector, PublicStream } from "@/lib/providers/sse";
import { requestIp } from "@/lib/security/ip";
import { unavailable, type Endpoint } from "@/lib/providers/types";
const bodySchema = z
  .object({
    model: z.string().min(1).max(200),
    messages: z
      .array(z.object({ role: z.string(), content: z.unknown() }).passthrough())
      .min(1)
      .optional(),
    input: z.union([z.string(), z.array(z.unknown())]).optional(),
    max_output_tokens: z.number().int().positive().optional(),
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
    if (selectedProvider === "mwapi" && endpoint === "responses/input_tokens")
      throw new AppError(
        "not_supported",
        "This account route does not provide Responses token counting. Messages token counting is available.",
        501,
      );
    const json = await readJson(req, 2_000_000);
    const body = bodySchema.parse(json);
    const responses = endpoint.startsWith("responses");
    const auxiliary =
      endpoint.includes("/compact") ||
      endpoint.includes("input_tokens") ||
      endpoint.includes("count_tokens");
    if (responses ? body.input === undefined : !body.messages)
      throw new AppError(
        "invalid_request",
        responses ? "input is required." : "messages is required.",
      );
    if (
      body.background === true ||
      body.store === true ||
      body.previous_response_id
    )
      throw new AppError(
        "invalid_request",
        "Use stateless requests: store=false, background=false, and include conversation input.",
      );
    if (auxiliary && body.stream)
      throw new AppError("invalid_request", "This endpoint does not stream.");
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
    const allowedModels = await availableModels(key);
    const model =
      allowedModels.find(m => m.provider === selectedProvider && customerModelId(m) === body.model) ??
      (row?.model ? importedCapabilities(row.model) : undefined) ??
      resolveClientAlias(body.model, selectedProvider, allowedModels);
    if (!model)
      throw new AppError(
        "model_not_found",
        "Model not found or not enabled for this key.",
        404,
      );
    if (model.provider !== selectedProvider)
      throw new AppError(
        "model_not_allowed",
        "This model uses a different API route. Use the base URL listed for it in your dashboard.",
        403,
      );
    if (!model.enabled || model.archivedAt || !model.visible)
      throw new AppError(
        "model_unavailable",
        "This model is currently unavailable.",
        403,
      );
    if (!allowedModels.some((m) => m.id === model.id))
      throw new AppError(
        "model_not_allowed",
        "This API key does not have access to this model.",
        403,
      );
    if (
      (endpoint.startsWith("messages") && !model.supportsAnthropicEndpoint) ||
      (endpoint === "chat/completions" && !model.supportsOpenaiEndpoint) ||
      (responses &&
        !model.supportsOpenaiEndpoint &&
        !model.supportsAnthropicEndpoint)
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
    if (
      (body.response_format ||
        (body.text &&
          typeof body.text === "object" &&
          "format" in body.text)) &&
      !model.supportsStructuredOutput
    )
      throw new AppError(
        "invalid_request",
        "Structured output is not supported.",
      );
    if (body.n !== undefined && body.n !== 1)
      throw new AppError(
        "invalid_request",
        "Only one completion per request is supported.",
      );
    if (
      (body.reasoning_effort || body.thinking || body.reasoning) &&
      !model.supportsReasoning
    )
      throw new AppError(
        "invalid_request",
        "Reasoning is not supported for this model.",
      );
    if (
      !model.supportsVision &&
      (body.messages ?? (Array.isArray(body.input) ? body.input : [])).some(
        (m) =>
          m &&
          typeof m === "object" &&
          "content" in m &&
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
      body.max_output_tokens ??
      body.max_completion_tokens ??
      body.max_tokens ??
      model.maxOutputTokens;
    if (maxOutput > model.maxOutputTokens)
      throw new AppError(
        "invalid_request",
        "Requested output exceeds model limit.",
      );
    if (!key.encryptedUpstreamKey || key.upstreamProvider !== selectedProvider)
      throw new AppError(
        "key_not_configured",
        "This key is not configured for this API route. Contact your administrator.",
        403,
      );
    const upstream = compatibleProvider(
      selectedProvider === "mwapi" ? "MWAPI" : "CLAUDE_N_CODEX",
      model.family,
      decrypt(key.encryptedUpstreamKey),
    );
    const reservation = await reserve(
      key.id,
      key.keyHash,
      model,
      endpoint,
      maxOutput,
      requestIp(req.headers),
      {
        provider: key.upstreamProvider,
        encryptedKey: key.encryptedUpstreamKey,
      },
    );
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 240_000);
    const payload: Record<string, unknown> = {
      ...body,
      model: model.upstreamModelId,
    };
    if (responses) {
      delete payload.max_tokens;
      delete payload.max_completion_tokens;
      if (!auxiliary) {
        payload.max_output_tokens = maxOutput;
        payload.store = false;
      }
    } else if (auxiliary) {
      delete payload.max_tokens;
    } else if (body.max_completion_tokens !== undefined) {
      payload.max_completion_tokens = maxOutput;
      delete payload.max_tokens;
    } else payload.max_tokens = maxOutput;
    if (body.stream && endpoint === "chat/completions")
      payload.stream_options = { include_usage: true };
    let response: Response;
    try {
      response = await upstream.send(endpoint, payload, abort.signal);
    } catch (error) {
      clearTimeout(timeout);
      const configurationError = error instanceof AppError && error.code === "provider_not_configured";
      const timedOut = abort.signal.aborted;
      const code = configurationError ? "provider_not_configured" : timedOut ? "provider_timeout" : "provider_connection_failed";
      // Only fixed diagnostic labels: never log URLs, headers, keys, or raw errors.
      console.error("somiti_provider_failure", { requestId: reservation.requestId, provider: selectedProvider, endpoint, code });
      await settle(reservation.requestId, unavailable, configurationError ? 503 : timedOut ? 504 : 502, Date.now() - started, code);
      if (configurationError) throw error;
      throw new AppError(code, timedOut
        ? "The API connection timed out. Contact your administrator with the request time."
        : "The API connection failed. Your administrator must check the server endpoint configuration and connectivity.", timedOut ? 504 : 502);
    }
    if (!response.ok) {
      let quotaExhausted = response.status === 402;
      try {
        const errorBody = await readJson(response, 16384);
        if (errorBody && typeof errorBody === "object") {
          const top = errorBody as Record<string, unknown>;
          const nested =
            top.error && typeof top.error === "object"
              ? (top.error as Record<string, unknown>)
              : {};
          quotaExhausted ||= [top.code, nested.code, nested.type].some(
            (code) =>
              typeof code === "string" &&
              [
                "API_KEY_QUOTA_EXHAUSTED",
                "INSUFFICIENT_QUOTA",
                "QUOTA_EXHAUSTED",
              ].includes(code.toUpperCase()),
          );
        }
      } catch {
        /* Never expose raw provider errors or credentials. */
      } finally {
        clearTimeout(timeout);
        await response.body?.cancel().catch(() => {});
      }
      await settle(
        reservation.requestId,
        unavailable,
        response.status,
        Date.now() - started,
        "provider_error",
      );
      const status = quotaExhausted
        ? 402
        : [400, 402, 413, 429].includes(response.status)
          ? response.status
          : 502;
      throw new AppError(
        quotaExhausted
          ? "quota_exhausted"
          : status === 429
            ? "rate_limit_exceeded"
            : "provider_error",
        status === 429
          ? "The assigned account is rate limited. Wait before retrying; contact your administrator if this continues."
          : status === 402
            ? "Your account quota is exhausted. Contact your administrator to restore credit. Retrying will not restore the balance."
            : status === 400
              ? "The assigned model rejected these request options. Check the model ID, token limit, and enabled capabilities."
              : "The assigned account could not complete the request. Contact your administrator with the request time.",
        status,
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
        if (value && typeof value === "object" && value.model)
          value.model = customerModelId(model);
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
    const publicStream = new PublicStream(customerModelId(model));
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
            if (collector.failed || (responses && !collector.responseCompleted))
              failure ||= "stream_incomplete";
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
              if (!disconnected) {
                if (!failure) controller.close();
                else {
                  try {
                    controller.error(new Error("Upstream stream failed"));
                  } catch {}
                }
              }
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
