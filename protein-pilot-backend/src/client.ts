// This module has no server/runtime dependencies. Store access tokens using the mobile OS keychain.
import type { Meal } from "./domain.js";
export type MealRecord = Meal & {
  id: string;
  version: number;
  day: string;
  totals: { calories: number; protein: number; carbs: number; fat: number };
};
export type DraftRecord = Meal & {
  id: string;
  version: number;
  mealId?: string;
  warnings?: string[];
  requiresReview?: boolean;
};
export type AnalysisJob = {
  id: string;
  state: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  draftId: string | null;
  error: string | null;
  result: unknown;
};
export class ProteinPilotError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: unknown = undefined,
  ) {
    super(message);
  }
}
export class ProteinPilotClient {
  constructor(
    private baseUrl: string,
    private token: () => Promise<string | null>,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const accessToken = await this.token();
    const multipart =
      typeof FormData !== "undefined" && body instanceof FormData;
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(body !== undefined && !multipart
          ? { "Content-Type": "application/json" }
          : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body:
        body === undefined
          ? undefined
          : multipart
            ? (body as FormData)
            : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok)
      throw new ProteinPilotError(
        response.status,
        data.error?.code || "request_failed",
        data.error?.message || "Request failed.",
        data.error?.fields,
      );
    return data as T;
  }
  requestLink(email: string) {
    return this.request("POST", "/v1/auth/request-link", { email });
  }
  verifyLink(token: string) {
    return this.request<{
      accessToken: string;
      expiresAt: number;
      userId: string;
    }>("POST", "/v1/auth/verify", { token });
  }
  me() {
    return this.request("GET", "/v1/me");
  }
  logMeal(meal: Meal, stableRequestId: string) {
    return this.request<MealRecord>("POST", "/v1/meals", meal, stableRequestId);
  }
  saveDraft(meal: Meal, stableRequestId: string) {
    return this.request<DraftRecord>(
      "POST",
      "/v1/drafts",
      meal,
      stableRequestId,
    );
  }
  confirmDraft(id: string, version: number, stableRequestId: string) {
    return this.request<MealRecord>(
      "POST",
      `/v1/drafts/${id}/confirm`,
      { version, reviewed: true },
      stableRequestId,
    );
  }
  analyze(
    form: FormData,
    mealType: Meal["mealType"],
    loggedAt: string,
    stableRequestId: string,
  ) {
    return this.request<{ id: string; state: "queued"; pollUrl: string }>(
      "POST",
      `/v1/analysis?mealType=${mealType}&loggedAt=${encodeURIComponent(loggedAt)}`,
      form,
      stableRequestId,
    );
  }
  job(id: string) {
    return this.request<AnalysisJob>("GET", `/v1/analysis/${id}`);
  }
  cancelAnalysis(id: string) {
    return this.request("POST", `/v1/analysis/${id}/cancel`, {});
  }
  day(day: string) {
    return this.request("GET", `/v1/days/${day}`);
  }
  signOut() {
    return this.request("POST", "/v1/auth/sign-out", {});
  }
}
export type PendingMeal = { requestId: string; userId: string; meal: Meal };
export interface OutboxStorage {
  load(): Promise<PendingMeal[]>;
  save(items: PendingMeal[]): Promise<void>;
}
// A lost response is safely retried with the SAME requestId. Never sync one account's queue into another.
// The caller serializes writes/sync and persists with encrypted device storage. Failed entries remain intact.
export async function syncMealOutbox(
  client: ProteinPilotClient,
  storage: OutboxStorage,
  currentUserId: string,
) {
  const pending = await storage.load();
  const saved: MealRecord[] = [];
  while (pending.length) {
    if (pending[0].userId !== currentUserId)
      throw new Error("Outbox belongs to a different account.");
    const result = await client.logMeal(pending[0].meal, pending[0].requestId);
    saved.push(result);
    pending.shift();
    await storage.save(pending);
  }
  return saved;
}
