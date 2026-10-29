import { test } from "node:test";
import assert from "node:assert/strict";
import { makePlan } from "../src/planner.js";
import { fixture, VirtualClock, profileBase } from "../scripts/eval/core.js";
const p = {
  ...profileBase,
  weightKg: 82.5,
  proteinInputs: {
    age: 32,
    heightCm: 180,
    training: "strength",
    trainingDays: 4,
    guidance: "none",
  },
  diet: "vegetarian",
};
const protein = (slots: any[]) =>
  Math.round(
    slots
      .flatMap((s) => s.foods)
      .reduce((n, f) => n + (f.grams * f.per100g.protein) / 100, 0) * 10,
  ) / 10;
test("seven full days meet independent target, deterministic portions and dietary restrictions", () => {
  for (const diet of ["omnivore", "vegetarian", "vegan", "pescatarian"]) {
    const plan = makePlan({ ...p, diet }, "2026-12-29");
    assert.equal(plan.slots.length, 21);
    assert.equal(plan.days.at(-1)?.day, "2027-01-04");
    assert.deepEqual(plan, makePlan({ ...p, diet }, "2026-12-29"));
    for (const day of plan.days) {
      assert.equal(day.target, 132);
      assert.ok(
        Math.abs(protein(plan.slots.filter((s) => s.day === day.day)) - 132) <=
          1,
      );
      for (const slot of plan.slots) {
        assert.ok(slot.servings >= 0.5 && slot.servings <= 2);
        assert.ok(slot.foods.every((f: any) => Number.isInteger(f.grams)));
      }
    }
    if (diet === "vegan")
      assert.ok(
        plan.slots.every(
          (s) => !JSON.stringify(s.foods).match(/yogurt|eggs|salmon|chicken/i),
        ),
      );
  }
  const restricted = makePlan(
    { ...p, diet: "vegan", allergies: ["soya"], exclusions: ["chickpeas"] },
    "2026-10-26",
  );
  assert.ok(restricted.slots.every((s) => s.recipeId === "lentil-bowl"));
  for (const bad of [
    { allergies: ["unknown allergen"] },
    { diet: "vegan", exclusions: ["legumes"] },
    { proteinInputs: { ...p.proteinInputs, guidance: "clinician" } },
    { proteinInputs: undefined },
  ])
    assert.throws(() => makePlan({ ...p, ...bad }, "2026-10-26"));
});
test("API generation, swap, stale profile, rebuild, logging and isolation", async () => {
  const s = await fixture(new VirtualClock());
  try {
    const t = (await s.signin("planner@proteinpilot.test")).accessToken;
    await s.call("PUT", "/v1/me/profile", p, t);
    const plan = await s.call(
      "POST",
      "/v1/plans",
      { week: "2026-10-26" },
      t,
      "planner-create-01",
    );
    assert.equal(
      (await s.call("GET", "/v1/achievements", undefined, t)).items.find(
        (v: any) => v.id === "mise-en-place",
      ).earned,
      true,
    );
    assert.deepEqual(
      await s.call(
        "POST",
        "/v1/plans",
        { week: "2026-10-26" },
        t,
        "planner-create-01",
      ),
      plan,
    );
    assert.equal(
      (await s.call("GET", "/v1/days/2026-10-26", undefined, t)).totals,
      null,
    );
    const slots = plan.slots.map((v: any, i: number) =>
      i === 0 ? { ...v, recipeId: "egg-bowl" } : v,
    );
    const swapped = await s.call(
      "PATCH",
      `/v1/plans/${plan.id}`,
      { version: plan.version, slots },
      t,
    );
    assert.ok(
      Math.abs(
        protein(swapped.slots.filter((v: any) => v.day === "2026-10-26")) - 132,
      ) <= 1,
    );
    assert.equal(
      (
        await s.raw(
          "PATCH",
          `/v1/plans/${plan.id}`,
          { version: plan.version, slots },
          t,
        )
      ).statusCode,
      409,
    );
    const other = (await s.signin("other-planner@proteinpilot.test"))
      .accessToken;
    assert.equal(
      (
        await s.raw(
          "POST",
          `/v1/plans/${plan.id}/regenerate`,
          { version: swapped.version },
          other,
          "other-plan-key",
        )
      ).statusCode,
      404,
    );
    await s.call(
      "PUT",
      "/v1/me/profile",
      { ...p, weightKg: 95, allergies: ["milk"] },
      t,
    );
    assert.equal(
      (await s.call("GET", "/v1/plans", undefined, t)).items[0].needsRebuild,
      true,
    );
    const rebuilt = await s.call(
      "POST",
      `/v1/plans/${plan.id}/regenerate`,
      { version: swapped.version },
      t,
      "rebuild-plan-key",
    );
    assert.ok(rebuilt.slots.every((v: any) => v.recipeId !== "yogurt-oats"));
    assert.ok(
      Math.abs(
        protein(rebuilt.slots.filter((v: any) => v.day === "2026-10-26")) - 152,
      ) <= 1,
    );
    const slot = rebuilt.slots[0];
    const meal = {
      name: slot.name,
      mealType: slot.mealType,
      foods: slot.foods,
      loggedAt: "2026-10-26T12:00:00Z",
      notes: "",
    };
    await s.call("POST", "/v1/meals", meal, t, "planned-meal-log");
    await s.call("POST", "/v1/meals", meal, t, "planned-meal-log");
    const today = await s.call("GET", "/v1/days/2026-10-26", undefined, t);
    assert.equal(today.meals.length, 1);
    assert.equal(today.totals.protein, protein([slot]));
    assert.equal(today.proteinTarget, 152);
  } finally {
    await s.app.close();
  }
});

test("planner refuses infeasible targets and incomplete days instead of relaxing rules", () => {
  assert.throws(
    () =>
      makePlan(
        {
          ...p,
          weightKg: 158,
          diet: "vegan",
          proteinInputs: { ...p.proteinInputs, heightCm: 230 },
        },
        "2026-10-26",
      ),
    /portion limits/,
  );
  const plan = makePlan(p, "2026-10-26");
  assert.throws(
    () => makePlan(p, "2026-10-26", plan.slots.slice(1)),
    /breakfast/,
  );
});
