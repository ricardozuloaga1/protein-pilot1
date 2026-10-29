import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateProtein } from "../src/protein.js";
import {
  fixture,
  VirtualClock,
  profileBase,
  fixedAI,
} from "../scripts/eval/core.js";
import { one } from "../src/db.js";
const inputs = {
  age: 30,
  heightCm: 180,
  training: "strength" as const,
  trainingDays: 3,
  guidance: "none" as const,
};
test("profile calculation uses actual training rather than asking for a target", () => {
  assert.equal(
    estimateProtein({ weightKg: 82.5, proteinInputs: inputs }).protein,
    132,
  );
  assert.equal(
    estimateProtein({ weightKg: 95, proteinInputs: inputs }).protein,
    152,
  );
  assert.equal(
    estimateProtein({ weightKg: 75, proteinInputs: inputs }).protein,
    120,
  );
  assert.equal(
    estimateProtein({
      weightKg: 75,
      proteinInputs: { ...inputs, training: "endurance" },
    }).protein,
    105,
  );
  assert.equal(
    estimateProtein({
      weightKg: 75,
      proteinInputs: { ...inputs, training: "none", trainingDays: 0 },
    }).protein,
    90,
  );
  assert.equal(
    estimateProtein({
      weightKg: 75,
      proteinInputs: { ...inputs, trainingDays: 1 },
    }).protein,
    90,
  );
  for (const change of [
    { age: 17 },
    { age: 72 },
    { guidance: "clinician" },
    { guidance: "pregnancy_breastfeeding" },
    { guidance: "prefer_not_to_say" },
    { heightCm: 120 },
  ])
    assert.equal(
      estimateProtein({ weightKg: 75, proteinInputs: { ...inputs, ...change } })
        .protein,
      null,
    );
  assert.throws(() => estimateProtein({ weightKg: 0, proteinInputs: inputs }));
  assert.throws(() =>
    estimateProtein({
      weightKg: 75,
      proteinInputs: { ...inputs, trainingDays: 0 },
    }),
  );
});
test("server computes targets atomically, preserves history, and does not send screening inputs to coach", async () => {
  let context: any;
  const clock = new VirtualClock();
  const s = await fixture(clock, {
    ...fixedAI,
    coach: async (c) => {
      context = c;
      return "Optional food idea";
    },
  });
  try {
    const auth = await s.signin("target-eval@proteinpilot.test");
    const t = auth.accessToken;
    let p = { ...profileBase, weightKg: 75, proteinInputs: inputs };
    const preview = await s.call("POST", "/v1/protein-preview", {
      weightKg: 75,
      proteinInputs: inputs,
    });
    assert.equal(preview.protein, 120);
    await s.call("PUT", "/v1/me/profile", p, t);
    assert.equal(
      (await s.call("GET", "/v1/days/2026-10-26", undefined, t)).proteinTarget,
      120,
    );
    assert.equal(
      (await s.raw("PUT", "/v1/me/target", { protein: 400 }, t)).statusCode,
      409,
    );
    clock.advance(86400000);
    p = { ...p, weightKg: 80 };
    await s.call("PUT", "/v1/me/profile", p, t);
    assert.equal(
      (await s.call("GET", "/v1/days/2026-10-27", undefined, t)).proteinTarget,
      128,
    );
    assert.equal(
      (await s.call("GET", "/v1/days/2026-10-26", undefined, t)).proteinTarget,
      120,
    );
    clock.advance(86400000);
    await s.call(
      "PUT",
      "/v1/me/profile",
      { ...p, proteinInputs: { ...inputs, guidance: "clinician" } },
      t,
    );
    const current = await s.call("GET", "/v1/days/2026-10-28", undefined, t);
    assert.equal(current.proteinTarget, null);
    assert.equal(current.targetReached, false);
    await s.call("POST", "/v1/coach/messages", { text: "Suggest dinner" }, t);
    assert.equal(context.profile.proteinInputs, undefined);
    assert.equal(context.today.targetGuidance, undefined);
    assert.equal(context.today.proteinTarget, null);
    await s.call("PUT", "/v1/me/profile", { ...profileBase, weightKg: 80 }, t);
    assert.equal(
      (await s.call("GET", "/v1/me", undefined, t)).profile.proteinInputs
        .guidance,
      "clinician",
    );
    const exported = await s.call("POST", "/v1/exports", {}, t);
    const data = await s.call("GET", exported.downloadUrl, undefined, t);
    assert.equal(data.target_guidance.length, 3);
    const fresh = await s.signin("target-eval@proteinpilot.test");
    await s.call(
      "DELETE",
      "/v1/me",
      { confirmation: "DELETE MY ACCOUNT" },
      fresh.accessToken,
    );
    assert.equal(one(s.db, "SELECT count(*) n FROM target_guidance").n, 0);
  } finally {
    await s.app.close();
  }
});
