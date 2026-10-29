import { fetch } from "expo/fetch";
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:3100";
export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  token: string | null,
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const form = body instanceof FormData;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75000);
  try {
    const res = await fetch(API_URL + path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(!form && body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok)
      throw new APIError(
        res.status,
        data.error?.code || "request_failed",
        data.error?.fields?.map((x: any) => x.message).join("\n") ||
          data.error?.message ||
          "Please try again.",
      );
    return data;
  } catch (e) {
    if (e instanceof APIError) throw e;
    throw new APIError(
      0,
      "offline",
      "Could not reach Protein Pilot. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
