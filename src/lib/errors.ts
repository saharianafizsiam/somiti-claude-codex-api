import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  const e =
    error instanceof AppError
      ? error
      : error instanceof ZodError
        ? new AppError(
            "invalid_request",
            error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
          )
        : new AppError(
            "internal_error",
            "The request could not be completed.",
            500,
          );
  return Response.json(
    { error: { message: e.message, type: e.code, code: e.code } },
    {
      status: e.status,
      headers: {
        "Cache-Control": "no-store",
        ...(e.status === 429 ? { "Retry-After": "60" } : {}),
      },
    },
  );
}
