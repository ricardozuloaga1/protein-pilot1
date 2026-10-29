import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Budget } from "../scripts/eval/budget.js";
test("budget preserves uncertain charges, prevents concurrent writers and enforces caps", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pilot-budget-"));
  const file = path.join(dir, "ledger.json");
  let b = new Budget(file);
  try {
    assert.throws(() => new Budget(file));
    assert.throws(() => b.reserve("wrong", "unknown"));
    for (let i = 0; i < 4; i++) b.reserve("unknown-" + i, "gpt-6.1-terra");
    assert.throws(() => b.reserve("over", "gpt-6.1-terra"));
    b.close();
    b = new Budget(file);
    assert.equal(b.entries.length, 4);
    assert.equal(b.committed(), 8.4);
    b.settle(0, {
      kind: "coach",
      model: "gpt-6.1-terra",
      serviceTier: "default",
      responseId: "test",
      usage: { input_tokens: 100, output_tokens: 100 },
    });
    assert.ok(b.committed() < 6.31);
  } finally {
    b.close();
    rmSync(dir, { recursive: true });
  }
});
test("sixty calls is a lifetime ceiling even when costs are tiny", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pilot-budget-"));
  const b = new Budget(path.join(dir, "ledger.json"));
  try {
    for (let i = 0; i < 60; i++) {
      const n = b.reserve("c" + i, "gpt-6.1-terra");
      b.settle(n, {
        kind: "image",
        model: "gpt-6.1-terra",
        serviceTier: "default",
        responseId: "t",
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    }
    assert.throws(() => b.reserve("61", "gpt-6.1-terra"));
  } finally {
    b.close();
    rmSync(dir, { recursive: true });
  }
});
