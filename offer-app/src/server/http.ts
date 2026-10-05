import { ZodError, z } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ZodError) {
    return Response.json({ error: "Validation failed", details: z.flattenError(err) }, { status: 400 });
  }
  if (err instanceof HttpError) {
    return Response.json({ error: err.message, details: err.details }, { status: err.status });
  }
  console.error("Unhandled API error", err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

/** Wraps a route handler so thrown HttpError/ZodError become consistent JSON responses. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Response | Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
