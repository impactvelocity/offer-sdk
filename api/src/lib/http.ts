import type { Context } from "hono";

export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 404 | 409 | 500 | 502 | 503,
    message: string,
  ) {
    super(message);
  }
}

export type Json = Record<string, any>;

// Parses the request body. Malformed JSON is a 400 rather than a 500.
export async function readJson(c: Context): Promise<any> {
  try {
    return await c.req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}

// Like readJson, but an empty body is `{}` (for routes where the body is optional).
export async function readOptionalJson(c: Context): Promise<any> {
  const text = await c.req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) ?? {};
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}

// Parses a body that must be a JSON object (used by PATCH merges).
export async function readObject(c: Context): Promise<Json> {
  const body = await readJson(c);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "Body must be a JSON object");
  }
  return body;
}

export function omit(obj: Json, keys: string[]): Json {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
}

export function pagination(c: Context) {
  const page = Math.max(parseInt(c.req.query("page") ?? "1", 10) || 1, 1);
  const perPage = Math.min(parseInt(c.req.query("per_page") ?? "20", 10) || 20, 100);
  return { page, perPage };
}

// `?limit=` clamped to 1..100, with a default for missing or invalid values.
export function limitParam(c: Context, fallback: number) {
  return Math.min(Math.max(parseInt(c.req.query("limit") ?? "", 10) || fallback, 1), 100);
}
