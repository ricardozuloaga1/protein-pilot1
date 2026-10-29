import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blankMeal,
  localDay,
  shiftDay,
  sum,
  validateMeal,
  type Meal,
} from "../src/model";
import { saveRemoteMeal, mealPayload, type Request } from "../src/meal-save";
const meal: Meal = {
  ...blankMeal(),
  name: "Tofu",
  foods: [
    {
      name: "Tofu",
      grams: 200,
      per100g: { calories: 144, protein: 17, carbs: 3, fat: 9 },
      source: "user",
    },
  ],
};
test("portion math and input validation", () => {
  assert.equal(sum(meal.foods).protein, 34);
  assert.equal(sum([{ ...meal.foods[0], grams: 150 }]).protein, 25.5);
  assert.equal(validateMeal(meal), undefined);
  assert.ok(validateMeal({ ...meal, foods: [] }));
  assert.ok(
    validateMeal({ ...meal, foods: [{ ...meal.foods[0], grams: NaN }] }),
  );
  assert.ok(validateMeal({ ...meal, loggedAt: "2099-01-01T00:00:00Z" }));
});
test("journal dates honor timezone across UTC midnight", () => {
  assert.equal(
    localDay("America/Caracas", new Date("2026-10-27T01:00:00Z")),
    "2026-10-26",
  );
  assert.equal(shiftDay("2026-03-01", -1), "2026-02-28");
});
test("manual save passes stable idempotency key and strips client-only fields", async () => {
  let body: any;
  let key: string | undefined;
  const request = (async (_p: string, _m: string, b: any, k: string) => {
    body = b;
    key = k;
    return { id: "saved" };
  }) as Request;
  await saveRemoteMeal(
    request,
    { ...meal, requestKey: "private", requestFingerprint: "meta" },
    "request-001",
  );
  assert.equal(key, "request-001");
  assert.equal(body.requestKey, undefined);
});
test("lost photo confirmation response resolves to existing meal without a mutation", async () => {
  const calls: string[] = [];
  const request = (async (path: string, method = "GET") => {
    calls.push(method);
    return path.includes("drafts")
      ? { mealId: "saved" }
      : { ...meal, id: "saved" };
  }) as Request;
  const result = await saveRemoteMeal(
    request,
    { ...meal, id: "draft", version: 1 },
    "request-001",
  );
  assert.equal(result.id, "saved");
  assert.deepEqual(calls, ["GET", "GET"]);
});
test("lost draft update response uses current content/version before confirmation", async () => {
  const calls: any[] = [];
  const request = (async (
    path: string,
    method = "GET",
    body?: any,
    key?: string,
  ) => {
    calls.push({ method, body, key });
    return method === "GET"
      ? { ...meal, id: "draft", version: 2 }
      : { ...meal, id: "saved" };
  }) as Request;
  await saveRemoteMeal(
    request,
    { ...meal, id: "draft", version: 1 },
    "request-001",
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.version, 2);
  assert.equal(calls[1].key, "confirm-draft-2");
});
test("editing a meal keeps identity even after navigating to add foods", async () => {
  const calls: any[] = [];
  const request = (async (path: string, method = "GET", body?: any) => {
    calls.push({ path, method, body });
    return method === "GET"
      ? { ...meal, name: "Old", version: 3 }
      : { id: "original" };
  }) as Request;
  const result = await saveRemoteMeal(
    request,
    { ...meal, editId: "original", editVersion: 3 },
    "request-001",
  );
  assert.equal(result.id, "original");
  assert.equal(calls[1].path, "/v1/meals/original");
  assert.equal(calls[1].method, "PATCH");
  assert.equal(calls[1].body.version, 3);
});
test("lost edit response is recognized without a second patch", async () => {
  let calls = 0;
  const request = (async () => {
    calls++;
    return { ...meal, id: "original", version: 4 };
  }) as Request;
  await saveRemoteMeal(
    request,
    { ...meal, editId: "original", editVersion: 3 },
    "request-001",
  );
  assert.equal(calls, 1);
});
