import { test } from "node:test";
import assert from "node:assert/strict";
import { totals } from "../src/domain.js";
import { imageMetrics } from "../scripts/eval/image-metrics.js";
test("tofu bowl decimal tie rounds consistently with its daily total", () => {
  const f = (name: string, grams: number, protein: number) => ({
    name,
    grams,
    per100g: { protein, calories: 0, carbs: 0, fat: 0 },
    source: "user" as const,
  });
  const bowl = [
    f("tofu", 200, 17),
    f("rice", 150, 2.7),
    f("broccoli", 100, 2.4),
  ];
  // Independent decimal arithmetic: 34 + 4.05 + 2.4 = 40.45, half-up => 40.5.
  assert.equal(totals(bowl).protein, 40.5);
  assert.equal(totals([...bowl, f("other meal", 150, 20)]).protein, 70.5);
});
test("engineering image triage flags errors strictly beyond the absolute or relative threshold", () => {
  const metric = (p: number, k: number) =>
    imageMetrics([{ grams: 100, per100g: { protein: p, calories: k } }], {
      grams: 100,
      protein: 20,
      calories: 200,
    });
  assert.equal(metric(25, 250).reviewRequired, false);
  assert.equal(metric(25.01, 200).reviewRequired, true);
  assert.equal(metric(20, 250.01).reviewRequired, true);
});
