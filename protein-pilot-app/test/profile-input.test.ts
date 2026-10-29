import { test } from "node:test";
import assert from "node:assert/strict";
import { decimalValue, reconcileDecimalText } from "../src/profile-input";
test("typing decimal weight survives numeric profile updates at every keystroke", () => {
  for (const text of ["8", "82", "82.", "82.5"])
    assert.equal(reconcileDecimalText(text, decimalValue(text)), text);
  assert.equal(decimalValue("82.5"), 82.5);
});
test("decimal comma, deletion, and a genuinely changed external value remain editable", () => {
  assert.equal(reconcileDecimalText("82,", 82), "82,");
  assert.equal(decimalValue("82,5"), 82.5);
  assert.equal(reconcileDecimalText("", null), "");
  assert.equal(reconcileDecimalText("82.5", 95), "95");
});
