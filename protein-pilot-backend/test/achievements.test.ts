import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, VirtualClock, makeMeal } from "../scripts/eval/core.js";
test("Field Notes badges use confirmed lifetime dates, rolling windows, gaps and account isolation", async () => {
  const clock = new VirtualClock();
  const s = await fixture(clock);
  try {
    let t = (await s.signin("badges@proteinpilot.test")).accessToken;
    const other = (await s.signin("other-badges@proteinpilot.test"))
      .accessToken;
    const read = async () =>
      (await s.call("GET", "/v1/achievements", undefined, t)).items;
    assert.equal(
      (await read()).some((v: any) => v.earned),
      false,
    );
    let last: any;
    for (const day of [0, 1, 2, 3, 4, 8, 9]) {
      clock.set(Date.parse("2026-10-26T12:00:00Z") + day * 86400000);
      const payload = makeMeal(clock, 100),
        key = s.key();
      last = await s.call("POST", "/v1/meals", payload, t, key);
      await s.call("POST", "/v1/meals", payload, t, key);
    }
    const badges = await read();
    for (const id of ["seedling", "seven-days", "rhythm", "homecoming"])
      assert.equal(badges.find((v: any) => v.id === id).earned, true);
    assert.equal(badges.find((v: any) => v.id === "rooted").earned, false);
    assert.equal(
      (await s.call("GET", "/v1/achievements", undefined, other)).items.some(
        (v: any) => v.earned,
      ),
      false,
    );
    await s.call(
      "DELETE",
      `/v1/meals/${last.id}`,
      { version: last.version },
      t,
    );
    assert.equal(
      (await read()).find((v: any) => v.id === "seven-days").earned,
      false,
    );
    for (let day = 10; day <= 23; day++) {
      clock.set(Date.parse("2026-10-26T12:00:00Z") + day * 86400000);
      await s.call("POST", "/v1/meals", makeMeal(clock, 100), t, s.key());
      if (day === 22)
        assert.equal(
          (await read()).find((v: any) => v.id === "rooted").earned,
          false,
        );
    }
    assert.equal(
      (await read()).find((v: any) => v.id === "rooted").earned,
      true,
    );
    clock.advance(50 * 86400000);
    t = (await s.signin("badges@proteinpilot.test")).accessToken;
    assert.equal(
      (await read()).find((v: any) => v.id === "rhythm").earned,
      true,
    );
  } finally {
    await s.app.close();
  }
});
