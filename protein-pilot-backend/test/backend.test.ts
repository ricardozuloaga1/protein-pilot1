import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { buildApp } from "../src/app.js";
import { configuration } from "../src/config.js";
import { defaultProfile, totals } from "../src/domain.js";
import { one, run } from "../src/db.js";
import type { AI, Analysis } from "../src/ai.js";
const sample = {
  name: "Lunch",
  mealType: "lunch",
  loggedAt: "2026-01-10T01:00:00Z",
  notes: "",
  foods: [
    {
      name: "Tofu",
      grams: 200,
      per100g: { calories: 144, protein: 17, carbs: 3, fat: 9 },
      source: "user",
    },
  ],
};
const estimate: Analysis = {
  status: "food",
  name: "Tofu bowl",
  foods: [
    {
      name: "Tofu",
      grams: 200,
      per100g: { calories: 144, protein: 17, carbs: 3, fat: 9 },
    },
  ],
  warnings: ["Check portion size."],
};
async function fixture(t: any, ai?: AI) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "protein-pilot-test-"));
  const links: string[] = [];
  const service = await buildApp({
    config: {
      ...configuration(),
      production: false,
      dataDir: dir,
      apiKey: "",
      smtp: undefined,
    },
    ai,
    mail: async (_e, link) => {
      links.push(link);
    },
    startWorker: !!ai,
  });
  t.after(async () => {
    await service.app.close();
    await rm(dir, { recursive: true, force: true });
  });
  const call = async (
    method: any,
    url: string,
    body?: any,
    token?: string,
    k?: string,
  ) =>
    service.app.inject({
      method,
      url,
      payload: body,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(k ? { "idempotency-key": k } : {}),
      },
    });
  const signIn = async (email: string) => {
    assert.equal(
      (await call("POST", "/v1/auth/request-link", { email })).statusCode,
      202,
    );
    const token = new URL(links.at(-1)!).hash.slice("#token=".length);
    const response = await call("POST", "/v1/auth/verify", { token });
    assert.equal(response.statusCode, 200, response.body);
    return { ...response.json(), linkToken: token };
  };
  const alice = await signIn("alice@example.com");
  return { ...service, call, signIn, alice, links };
}
test("magic links are single-use, sessions revoke, private routes require auth", async (t) => {
  const s = await fixture(t);
  assert.equal((await s.call("GET", "/v1/me")).statusCode, 401);
  assert.equal(
    (await s.call("POST", "/v1/auth/verify", { token: s.alice.linkToken }))
      .statusCode,
    401,
  );
  assert.equal(
    (await s.call("GET", "/v1/me", undefined, s.alice.accessToken)).statusCode,
    200,
  );
  await s.call("POST", "/v1/auth/sign-out", {}, s.alice.accessToken);
  assert.equal(
    (await s.call("GET", "/v1/me", undefined, s.alice.accessToken)).statusCode,
    401,
  );
});
test("atomic, idempotent logging; changed requests conflict; users cannot access each other", async (t) => {
  const s = await fixture(t);
  const token = s.alice.accessToken;
  const a = await s.call(
    "POST",
    "/v1/meals",
    sample,
    token,
    "meal-request-001",
  );
  assert.equal(a.statusCode, 201, a.body);
  const b = await s.call(
    "POST",
    "/v1/meals",
    sample,
    token,
    "meal-request-001",
  );
  assert.equal(a.json().id, b.json().id);
  assert.equal(one(s.db, "SELECT count(*) n FROM meals").n, 1);
  assert.equal(a.json().totals.protein, 34);
  assert.equal(
    (
      await s.call(
        "POST",
        "/v1/meals",
        { ...sample, name: "Other" },
        token,
        "meal-request-001",
      )
    ).statusCode,
    409,
  );
  const bob = await s.signIn("bob@example.com");
  assert.equal(
    (
      await s.call(
        "GET",
        `/v1/meals/${a.json().id}`,
        undefined,
        bob.accessToken,
      )
    ).statusCode,
    404,
  );
});
test("draft confirmation does not count until reviewed and never duplicates", async (t) => {
  const s = await fixture(t);
  const token = s.alice.accessToken;
  const d = (
    await s.call("POST", "/v1/drafts", sample, token, "draft-request-001")
  ).json();
  assert.equal(one(s.db, "SELECT count(*) n FROM meals").n, 0);
  assert.equal(
    (
      await s.call(
        "POST",
        `/v1/drafts/${d.id}/confirm`,
        { version: 1, reviewed: false },
        token,
        "confirm-001",
      )
    ).statusCode,
    400,
  );
  const first = await s.call(
    "POST",
    `/v1/drafts/${d.id}/confirm`,
    { version: 1, reviewed: true },
    token,
    "confirm-001",
  );
  assert.equal(first.statusCode, 200, first.body);
  const second = await s.call(
    "POST",
    `/v1/drafts/${d.id}/confirm`,
    { version: 1, reviewed: true },
    token,
    "confirm-002",
  );
  assert.equal(second.json().id, first.json().id);
  assert.equal(one(s.db, "SELECT count(*) n FROM meals").n, 1);
});
test("timezone day boundaries, empty-day gaps, historic targets and edit conflict", async (t) => {
  const s = await fixture(t);
  const token = s.alice.accessToken;
  await s.call(
    "PUT",
    "/v1/me/profile",
    { ...defaultProfile, timezone: "America/Caracas" },
    token,
  );
  const m = (
    await s.call("POST", "/v1/meals", sample, token, "meal-request-001")
  ).json();
  assert.equal(m.day, "2026-01-09");
  const before = await s.call("GET", "/v1/days/2026-01-09", undefined, token);
  assert.equal(before.json().totals.protein, 34);
  assert.equal(before.json().proteinTarget, null);
  await s.call("PUT", "/v1/me/target", { protein: 140 }, token);
  assert.equal(
    (await s.call("GET", "/v1/days/2026-01-09", undefined, token)).json()
      .proteinTarget,
    null,
  );
  const progress = (
    await s.call(
      "GET",
      "/v1/progress?from=2026-01-09&to=2026-01-10",
      undefined,
      token,
    )
  ).json();
  assert.equal(progress.days[1].totals, null);
  assert.equal(
    (
      await s.call(
        "PATCH",
        `/v1/meals/${m.id}`,
        { ...sample, version: 1, name: "Updated" },
        token,
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await s.call(
        "PATCH",
        `/v1/meals/${m.id}`,
        { ...sample, version: 1 },
        token,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (await s.call("GET", "/v1/days/2026-02-30", undefined, token)).statusCode,
    400,
  );
});
test("remove and undo updates totals without creating another meal", async (t) => {
  const s = await fixture(t);
  const token = s.alice.accessToken;
  const m = (
    await s.call("POST", "/v1/meals", sample, token, "meal-request-001")
  ).json();
  assert.equal(
    (await s.call("DELETE", `/v1/meals/${m.id}`, { version: 1 }, token))
      .statusCode,
    200,
  );
  assert.equal(
    (await s.call("GET", "/v1/days/2026-01-10", undefined, token)).json()
      .totals,
    null,
  );
  assert.equal(
    (await s.call("POST", `/v1/meals/${m.id}/restore`, { version: 2 }, token))
      .statusCode,
    200,
  );
  assert.equal(
    (await s.call("GET", "/v1/days/2026-01-10", undefined, token)).json().totals
      .protein,
    34,
  );
});
async function upload(s: any, bytes?: Buffer, k = "photo-upload-001") {
  const image =
    bytes ||
    (await sharp({
      create: { width: 16, height: 16, channels: 3, background: "#77aa44" },
    })
      .png()
      .toBuffer());
  const boundary = "testProteinPilotBoundary";
  return s.app.inject({
    method: "POST",
    url: "/v1/analysis?mealType=lunch&loggedAt=2026-01-10T12%3A00%3A00Z",
    headers: {
      authorization: `Bearer ${s.alice.accessToken}`,
      "idempotency-key": k,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="food.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      image,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
}
test("photo analysis requires consent, strips original, yields only draft, removes image", async (t) => {
  let received: Buffer | undefined;
  const s = await fixture(t, {
    analyze: async (b) => {
      received = b;
      return estimate;
    },
    coach: async () => "",
  });
  assert.equal((await upload(s)).statusCode, 403);
  await s.call(
    "PUT",
    "/v1/me/profile",
    { ...defaultProfile, photoConsent: true },
    s.alice.accessToken,
  );
  assert.equal((await upload(s, Buffer.from("not an image"))).statusCode, 415);
  const response = await upload(s);
  assert.equal(response.statusCode, 202, response.body);
  await s.jobs!.tick();
  const job = one(s.db, "SELECT * FROM jobs WHERE id=?", response.json().id);
  assert.equal(job.state, "succeeded");
  assert.equal(job.image, null);
  assert.ok(job.draft_id);
  assert.equal((await sharp(received!).metadata()).format, "jpeg");
  assert.equal(one(s.db, "SELECT count(*) n FROM meals").n, 0);
  const retry = await upload(s);
  assert.equal(retry.json().id, response.json().id);
  assert.equal(one(s.db, "SELECT count FROM ai_usage").count, 1);
  const stored = one(
    s.db,
    "SELECT * FROM meal_photos WHERE draft_id=?",
    job.draft_id,
  );
  const dimensions = await sharp(stored.image).metadata();
  assert.equal(dimensions.width, 256);
  assert.equal(dimensions.height, 256);
  assert.equal(dimensions.exif, undefined);
  const confirmed = await s.call(
    "POST",
    `/v1/drafts/${job.draft_id}/confirm`,
    { version: 1, reviewed: true },
    s.alice.accessToken,
    "photo-confirm-test",
  );
  assert.equal(confirmed.statusCode, 200, confirmed.body);
  const mid = confirmed.json().id;
  const photo = await s.call(
    "GET",
    `/v1/meals/${mid}/photo`,
    undefined,
    s.alice.accessToken,
  );
  assert.equal(photo.statusCode, 200);
  assert.equal(photo.headers["content-type"], "image/jpeg");
  assert.match(String(photo.headers["cache-control"]), /no-store/);
  assert.deepEqual(photo.rawPayload, stored.image);
  assert.equal((await s.call("GET", `/v1/meals/${mid}/photo`)).statusCode, 401);
  const bob = await s.signIn("bob@example.com");
  assert.equal(
    (await s.call("GET", `/v1/meals/${mid}/photo`, undefined, bob.accessToken))
      .statusCode,
    404,
  );
  const removed = await s.call(
    "DELETE",
    `/v1/meals/${mid}`,
    { version: 1 },
    s.alice.accessToken,
  );
  assert.equal(removed.statusCode, 200);
  assert.equal(
    (
      await s.call(
        "GET",
        `/v1/meals/${mid}/photo`,
        undefined,
        s.alice.accessToken,
      )
    ).statusCode,
    404,
  );
  await s.call(
    "POST",
    `/v1/meals/${mid}/restore`,
    { version: 2 },
    s.alice.accessToken,
  );
  assert.equal(
    (
      await s.call(
        "GET",
        `/v1/meals/${mid}/photo`,
        undefined,
        s.alice.accessToken,
      )
    ).statusCode,
    200,
  );
  await s.call(
    "DELETE",
    `/v1/meals/${mid}`,
    { version: 3 },
    s.alice.accessToken,
  );
  run(
    s.db,
    "UPDATE meals SET deleted_at=? WHERE id=?",
    Date.now() - 31_000,
    mid,
  );
  await s.jobs!.tick();
  assert.equal(one(s.db, "SELECT count(*) n FROM meal_photos").n, 0);
});
test("cancellation wins against a late successful provider response", async (t) => {
  let resolve: (a: Analysis) => void = () => {};
  let started: () => void = () => {};
  const begun = new Promise<void>((r) => (started = r));
  const s = await fixture(t, {
    analyze: async () => {
      started();
      return new Promise((r) => (resolve = r));
    },
    coach: async () => "",
  });
  await s.call(
    "PUT",
    "/v1/me/profile",
    { ...defaultProfile, photoConsent: true },
    s.alice.accessToken,
  );
  const j = (await upload(s)).json();
  const running = s.jobs!.tick();
  await begun;
  await s.call("POST", `/v1/analysis/${j.id}/cancel`, {}, s.alice.accessToken);
  resolve(estimate);
  await running;
  assert.equal(
    one(s.db, "SELECT state FROM jobs WHERE id=?", j.id).state,
    "cancelled",
  );
  assert.equal(one(s.db, "SELECT count(*) n FROM drafts").n, 0);
});
test("provider failures never create fake foods and clear photo bytes", async (t) => {
  const s = await fixture(t, {
    analyze: async () => {
      throw Object.assign(new Error("do not log sensitive provider response"), {
        status: 429,
      });
    },
    coach: async () => "",
  });
  await s.call(
    "PUT",
    "/v1/me/profile",
    { ...defaultProfile, photoConsent: true },
    s.alice.accessToken,
  );
  const j = (await upload(s)).json();
  await s.jobs!.tick();
  const result = one(s.db, "SELECT * FROM jobs WHERE id=?", j.id);
  assert.equal(result.state, "failed");
  assert.equal(result.error, "provider_rate_limit");
  assert.equal(result.image, null);
  assert.equal(result.draft_id, null);
});
test("no-food result succeeds without a draft; quota limits new analyses", async (t) => {
  const s = await fixture(t, {
    analyze: async () => ({
      status: "no_food",
      name: "",
      foods: [],
      warnings: [],
    }),
    coach: async () => "",
  });
  await s.call(
    "PUT",
    "/v1/me/profile",
    { ...defaultProfile, photoConsent: true },
    s.alice.accessToken,
  );
  const j = (await upload(s)).json();
  await s.jobs!.tick();
  assert.equal(
    one(s.db, "SELECT draft_id FROM jobs WHERE id=?", j.id).draft_id,
    null,
  );
  run(s.db, "UPDATE ai_usage SET count=20");
  assert.equal(
    (await upload(s, undefined, "photo-upload-002")).statusCode,
    429,
  );
});
test("plans and favorites do not become consumed meals; dietary filters apply", async (t) => {
  const s = await fixture(t);
  const token = s.alice.accessToken;
  await s.call(
    "PUT",
    "/v1/me/profile",
    {
      ...defaultProfile,
      weightKg: 75,
      proteinInputs: {
        age: 32,
        heightCm: 180,
        training: "strength",
        trainingDays: 4,
        guidance: "none",
      },
      diet: "vegan",
      allergies: ["soy"],
    },
    token,
  );
  const response = await s.call(
    "POST",
    "/v1/plans",
    { week: "2026-01-05" },
    token,
    "plan-week-001",
  );
  assert.equal(response.statusCode, 200, response.body);
  assert.ok(
    response
      .json()
      .slots.every((s: any) =>
        ["lentil-bowl", "chickpea-bowl"].includes(s.recipeId),
      ),
  );
  assert.equal(one(s.db, "SELECT count(*) n FROM meals").n, 0);
  assert.equal(
    (
      await s.call(
        "POST",
        "/v1/favorites",
        { name: "Lunch", foods: sample.foods },
        token,
        "favorite-001",
      )
    ).statusCode,
    200,
  );
});
test("exports omit secrets and deletion requires recent sign-in and cascades records", async (t) => {
  const s = await fixture(t);
  const token = s.alice.accessToken;
  await s.call("POST", "/v1/meals", sample, token, "meal-request-001");
  const ex = (await s.call("POST", "/v1/exports", {}, token)).json();
  const downloaded = await s.call("GET", ex.downloadUrl, undefined, token);
  assert.equal(downloaded.statusCode, 200);
  assert.equal(downloaded.json().meals.length, 1);
  assert.ok(!downloaded.body.includes(token));
  assert.ok(!downloaded.body.includes("session"));
  run(s.db, "UPDATE sessions SET verified_at=?", Date.now() - 11 * 60_000);
  assert.equal(
    (
      await s.call(
        "DELETE",
        "/v1/me",
        { confirmation: "DELETE MY ACCOUNT" },
        token,
      )
    ).statusCode,
    403,
  );
  run(s.db, "UPDATE sessions SET verified_at=?", Date.now());
  assert.equal(
    (
      await s.call(
        "DELETE",
        "/v1/me",
        { confirmation: "DELETE MY ACCOUNT" },
        token,
      )
    ).statusCode,
    200,
  );
  assert.equal(one(s.db, "SELECT count(*) n FROM meals").n, 0);
  assert.equal(one(s.db, "SELECT count(*) n FROM users").n, 0);
  assert.equal(
    (await s.call("GET", "/v1/me", undefined, token)).statusCode,
    401,
  );
});
test("input constraints reject negative macros, future logs and missing idempotency key", async (t) => {
  const s = await fixture(t);
  const token = s.alice.accessToken;
  assert.equal(
    (await s.call("POST", "/v1/meals", sample, token)).statusCode,
    400,
  );
  assert.equal(
    (
      await s.call(
        "POST",
        "/v1/meals",
        { ...sample, loggedAt: "2099-01-01T12:00:00Z" },
        token,
        "future-001",
      )
    ).statusCode,
    422,
  );
  assert.equal(
    (
      await s.call(
        "POST",
        "/v1/meals",
        { ...sample, foods: [{ ...sample.foods[0], grams: -1 }] },
        token,
        "invalid-001",
      )
    ).statusCode,
    400,
  );
  assert.equal(totals(sample.foods as any).protein, 34);
});
