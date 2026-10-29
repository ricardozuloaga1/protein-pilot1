import sharp from "sharp";
import { createHash } from "node:crypto";
import { all, one } from "../../src/db.js";
import {
  fixture,
  profiles,
  VirtualClock,
  Report,
  options,
  makeMeal,
  referenceTotals,
  profileBase,
  fixedAI,
} from "./core.js";
const o = options(),
  clock = new VirtualClock(),
  report = new Report(o.seed, clock);
const selected = profiles.filter(
  (p) => o.scenario === "all" || o.scenario === p.id,
);
if (!selected.length && !["boundaries", "rate-limits"].includes(o.scenario))
  throw Error("Unknown scenario");
const s = await fixture(clock);
let userDays = 0;
const image = await sharp({
  create: { width: 64, height: 64, channels: 3, background: "#4b6041" },
})
  .jpeg()
  .toBuffer();
const states: any[] = [];
const seedN = createHash("sha256").update(o.seed).digest().readUInt32BE();
const start = clock.now();
try {
  for (const p of selected) {
    const auth = await s.signin(p.email);
    const token = auth.accessToken;
    await s.call("PUT", "/v1/me/profile", p.profile, token);
    await s.call("PUT", "/v1/me/target", { protein: p.target }, token);
    const me = await s.call("GET", "/v1/me", undefined, token);
    report.check(p.id, "onboarding profile", me.profile, p.profile);
    if (Object.keys(p.extra).some((k) => k !== "timezone"))
      report.gap(
        p.id,
        "specialized planning inputs",
        "not implemented",
        `Not supported by current profile schema: ${Object.keys(p.extra)
          .filter((k) => k !== "timezone")
          .join(", ")}`,
      );
    states.push({ p, auth, token, days: [], target: p.target, meals: [] });
  }
  for (let day = 0; day < 42; day++) {
    clock.set(start + day * 86400000);
    for (const u of states) {
      const { p } = u;
      const date = new Date(start + day * 86400000).toISOString().slice(0, 10);
      userDays++;
      try {
        if (day === 30) {
          report.check(
            p.id,
            "session expires after 30 days",
            (await s.raw("GET", "/v1/me", undefined, u.token)).statusCode,
            401,
          );
          u.auth = await s.signin(p.email);
          u.token = u.auth.accessToken;
        }
        const t = u.token;
        if (day === 21) {
          u.target = p.target + 10;
          await s.call("PUT", "/v1/me/target", { protein: u.target }, t);
        }
        let grams = 0;
        const missing =
          (p.id === "offline" && day % 5 === 0) ||
          (day >= 14 && day <= 20 && day % 3 === 0);
        const count = day >= 14 && day <= 20 ? 1 : 3;
        if (!missing)
          for (let n = 0; n < count; n++) {
            const g = [125, 175, 250, 325][(seedN + day + n) % 4];
            let meal = makeMeal(clock, g);
            const k = s.key();
            let saved: any;
            if (day === 2 && n === 0) {
              const before = await s.call(
                "GET",
                `/v1/days/${date}`,
                undefined,
                t,
              );
              const up = await s.upload(t, image);
              if (up.statusCode !== 202) throw Error("Photo submission failed");
              await s.jobs!.tick();
              const job = await s.call("GET", up.json().pollUrl, undefined, t);
              const after = await s.call(
                "GET",
                `/v1/days/${date}`,
                undefined,
                t,
              );
              report.check(
                p.id,
                "photo draft not intake",
                after.totals,
                before.totals,
              );
              const draft = await s.call(
                "PUT",
                `/v1/drafts/${job.draftId}`,
                { ...meal, version: 1 },
                t,
              );
              saved = await s.call(
                "POST",
                `/v1/drafts/${draft.id}/confirm`,
                { version: draft.version, reviewed: true },
                t,
                k,
              );
              const retry = await s.call(
                "POST",
                `/v1/drafts/${draft.id}/confirm`,
                { version: draft.version, reviewed: true },
                t,
                s.key(),
              );
              report.check(
                p.id,
                "confirmation retry same meal",
                retry.id === saved.id,
                true,
              );
              report.check(
                p.id,
                "thumbnail accessible",
                (
                  await s.raw(
                    "GET",
                    `/v1/meals/${saved.id}/photo`,
                    undefined,
                    t,
                  )
                ).statusCode,
                200,
              );
              await s.call(
                "DELETE",
                `/v1/meals/${saved.id}/photo`,
                undefined,
                t,
              );
              report.check(
                p.id,
                "thumbnail removed",
                (
                  await s.raw(
                    "GET",
                    `/v1/meals/${saved.id}/photo`,
                    undefined,
                    t,
                  )
                ).statusCode,
                404,
              );
            } else {
              saved = await s.call("POST", "/v1/meals", meal, t, k);
              const retry = await s.call("POST", "/v1/meals", meal, t, k);
              report.check(
                p.id,
                `d${day} m${n} retry identity`,
                retry.id === saved.id,
                true,
              );
            }
            grams += g;
            u.meals.push(saved.id);
            report.check(
              p.id,
              `d${day} m${n} portion arithmetic`,
              saved.totals,
              referenceTotals(g),
            );
            if (day === 22 && n === 0) {
              saved = await s.call(
                "PATCH",
                `/v1/meals/${saved.id}`,
                {
                  ...meal,
                  foods: [{ ...meal.foods[0], grams: g + 25 }],
                  version: saved.version,
                },
                t,
              );
              grams += 25;
              report.check(
                p.id,
                "stale edit rejected",
                (
                  await s.raw(
                    "PATCH",
                    `/v1/meals/${saved.id}`,
                    { ...meal, version: 1 },
                    t,
                  )
                ).statusCode,
                409,
              );
            }
            if (day === 23 && n === 0) {
              const del = await s.call(
                "DELETE",
                `/v1/meals/${saved.id}`,
                { version: saved.version },
                t,
              );
              const undo = await s.call(
                "POST",
                `/v1/meals/${saved.id}/restore`,
                { version: del.version },
                t,
              );
              report.check(
                p.id,
                "undo retains identity",
                undo.id === saved.id,
                true,
              );
            }
            if (day === 8 && n === 0) {
              const fav = await s.call(
                "POST",
                "/v1/favorites",
                { name: meal.name, foods: meal.foods },
                t,
                s.key(),
              );
              report.check(
                p.id,
                "favorite present",
                (await s.call("GET", "/v1/favorites", undefined, t)).items.some(
                  (f: any) => f.id === fav.id,
                ),
                true,
              );
            }
          }
        // Delayed outbox uploads use the original timestamp and stable key after reconnect.
        if (p.id === "offline" && day === 19) {
          const oldDay = new Date(start + 18 * 86400000)
            .toISOString()
            .slice(0, 10);
          const m = {
            ...makeMeal(clock, 100),
            loggedAt: oldDay + "T12:00:00Z",
          };
          const k = s.key();
          const a = await s.call("POST", "/v1/meals", m, t, k);
          const b = await s.call("POST", "/v1/meals", m, t, k);
          report.check(p.id, "delayed upload once", a.id === b.id, true);
          u.days[18].grams += 100;
        }
        u.days.push({ day: date, grams, target: u.target });
        if (day === 7) {
          const before = await s.call("GET", `/v1/days/${date}`, undefined, t);
          const response = await s.raw(
            "POST",
            "/v1/plans",
            { week: date },
            t,
            s.key(),
          );
          report.check(
            p.id,
            "legacy profile cannot bypass calculated-target planning",
            response.statusCode,
            422,
          );
          report.gap(
            p.id,
            "full-day plan and swaps for legacy fixture",
            "not run",
            "This original accepted-target fixture has no complete screening inputs. Profile-derived planner journeys are covered separately by test/planner.test.ts and evaluation/planner; do not infer missing health inputs.",
          );
          report.check(
            p.id,
            "rejected plan does not change intake",
            (await s.call("GET", `/v1/days/${date}`, undefined, t)).totals,
            before.totals,
          );
        }

        const actual = await s.call("GET", `/v1/days/${date}`, undefined, t);
        report.check(
          p.id,
          `d${day} daily totals`,
          actual.totals,
          grams ? referenceTotals(grams) : null,
        );
        report.check(
          p.id,
          `d${day} effective target`,
          actual.proteinTarget,
          u.target,
        );
        report.check(
          p.id,
          `d${day} target reached`,
          actual.targetReached,
          grams > 0 && referenceTotals(grams).protein >= u.target,
        );
        if (day === 35) {
          await s.call(
            "POST",
            "/v1/coach/messages",
            { text: "Suggest an optional meal." },
            t,
          );
          report.check(
            p.id,
            "coach persisted",
            (await s.call("GET", "/v1/coach/messages", undefined, t)).items
              .length,
            2,
          );
        }
      } catch (e) {
        report.check(
          p.id,
          `d${day} workflow exception`,
          (e as Error).message,
          "no error",
        );
      }
    }
  }
  const observer = await s.signin("observer@proteinpilot.test");
  for (const u of states) {
    const { p } = u;
    try {
      const progress = await s.call(
        "GET",
        "/v1/progress?from=2026-10-26&to=2026-12-06",
        undefined,
        u.token,
      );
      report.check(
        p.id,
        "42-day history",
        progress.days.map((d: any) => ({
          day: d.day,
          totals: d.totals,
          target: d.proteinTarget,
        })),
        u.days.map((d: any) => ({
          day: d.day,
          totals: d.grams ? referenceTotals(d.grams) : null,
          target: d.target,
        })),
      );
      report.check(
        p.id,
        "logged day count",
        progress.daysWithEntries,
        u.days.filter((d: any) => d.grams > 0).length,
      );
      report.check(
        p.id,
        "historical target hit count",
        progress.daysAtTarget,
        u.days.filter(
          (d: any) =>
            d.grams > 0 && referenceTotals(d.grams).protein >= d.target,
        ).length,
      );
      report.check(
        p.id,
        "quality score not fabricated",
        progress.quality.score,
        null,
      );
      const other = observer;
      if (other)
        report.check(
          p.id,
          "cross-account meal rejected",
          (
            await s.raw(
              "GET",
              `/v1/meals/${u.meals[0]}`,
              undefined,
              other.accessToken,
            )
          ).statusCode,
          404,
        );
      const exp = await s.call("POST", "/v1/exports", {}, u.token);
      const data = await s.call("GET", exp.downloadUrl, undefined, u.token);
      report.check(p.id, "export owner", data.account.email, p.email);
      report.check(
        p.id,
        "export excludes auth secrets",
        Object.keys(data).some((k) => ["sessions", "auth_links"].includes(k)),
        false,
      );
      report.check(
        p.id,
        "deletion requires fresh signin",
        (
          await s.raw(
            "DELETE",
            "/v1/me",
            { confirmation: "DELETE MY ACCOUNT" },
            u.token,
          )
        ).statusCode,
        403,
      );
      u.token = (await s.signin(p.email)).accessToken;
      await s.call(
        "DELETE",
        "/v1/me",
        { confirmation: "DELETE MY ACCOUNT" },
        u.token,
      );
      report.check(
        p.id,
        "deleted session rejected",
        (await s.raw("GET", "/v1/me", undefined, u.token)).statusCode,
        401,
      );
      for (const table of [
        "meals",
        "drafts",
        "meal_photos",
        "jobs",
        "plans",
        "favorites",
        "sessions",
        "targets",
        "exports",
        "messages",
        "ai_usage",
        "operations",
      ])
        report.check(
          p.id,
          `deletion cascade ${table}`,
          one(
            s.db,
            `SELECT count(*) n FROM ${table} WHERE user_id=?`,
            u.auth.userId,
          ).n,
          0,
        );
    } catch (e) {
      report.check(
        p.id,
        "final workflow exception",
        (e as Error).message,
        "no error",
      );
    }
  }
  report.gap(
    "capabilities",
    "full-day planner in this legacy fixture suite",
    "not run",
    "Implemented for supported complete profiles; separately tested in planner.test.ts and iOS evaluation/planner. Original fixtures retain manually accepted targets and do not infer missing screening inputs.",
  );
  report.gap(
    "capabilities",
    "expanded lifetime achievements",
    "not implemented",
    "Current UI shows selected-period counts, not named lifetime achievement rules.",
  );
  report.gap(
    "capabilities",
    "verified food quality and nutrient reference data",
    "not implemented",
    "No curated amino-acid/digestibility database. Arithmetic fixtures are synthetic labels, not nutrition validation.",
  );
  report.gap(
    "offline",
    "native queue network fault",
    "not run",
    "API delayed-upload test is not proof of native SecureStore/outbox behavior; see simulator results.",
  );
} finally {
  await s.app.close();
}
if (o.scenario === "all" || o.scenario === "boundaries") {
  const c = new VirtualClock(Date.parse("2026-10-31T12:00:00Z"));
  const f = await fixture(c);
  report.clock = c;
  try {
    let a = await f.signin("boundary@proteinpilot.test");
    let t = a.accessToken;
    await f.call(
      "PUT",
      "/v1/me/profile",
      { ...profileBase, timezone: "America/New_York" },
      t,
    );
    await f.call("PUT", "/v1/me/target", { protein: 100 }, t);
    c.set("2026-11-01T07:00:00Z");
    for (const [instant, day] of [
      ["2026-11-01T03:59:00Z", "2026-10-31"],
      ["2026-11-01T04:01:00Z", "2026-11-01"],
      ["2026-11-01T05:30:00Z", "2026-11-01"],
      ["2026-11-01T06:30:00Z", "2026-11-01"],
    ]) {
      const m = await f.call(
        "POST",
        "/v1/meals",
        { ...makeMeal(c), loggedAt: instant },
        t,
        f.key(),
      );
      report.check("boundaries", `DST ${instant}`, m.day, day);
    }
    report.check(
      "boundaries",
      "invalid calendar date",
      (await f.raw("GET", "/v1/days/2026-02-30", undefined, t)).statusCode,
      400,
    );
    report.check(
      "boundaries",
      "future meal",
      (
        await f.raw(
          "POST",
          "/v1/meals",
          { ...makeMeal(c), loggedAt: "2027-01-01T00:00:00Z" },
          t,
          f.key(),
        )
      ).statusCode,
      422,
    );
    const m = await f.call("POST", "/v1/meals", makeMeal(c), t, f.key());
    const del = await f.call(
      "DELETE",
      `/v1/meals/${m.id}`,
      { version: m.version },
      t,
    );
    c.advance(31000);
    report.check(
      "boundaries",
      "undo expiry",
      (
        await f.raw(
          "POST",
          `/v1/meals/${m.id}/restore`,
          { version: del.version },
          t,
        )
      ).statusCode,
      409,
    );
    const exp = await f.call("POST", "/v1/exports", {}, t);
    c.advance(3600001);
    report.check(
      "boundaries",
      "export expiry",
      (await f.raw("GET", exp.downloadUrl, undefined, t)).statusCode,
      410,
    );
    await f.call("POST", "/v1/auth/request-link", {
      email: "expired@proteinpilot.test",
    });
    const link = new URL(
      f.mailbox.get("expired@proteinpilot.test")!,
    ).hash.slice(7);
    c.advance(900001);
    report.check(
      "boundaries",
      "link expiry",
      (await f.raw("POST", "/v1/auth/verify", { token: link })).statusCode,
      401,
    );
    const up = await f.upload(t, image);
    c.advance(86400001);
    f.jobs!.prune();
    const expired = await f.call("GET", up.json().pollUrl, undefined, t);
    report.check("boundaries", "queued photo expiry", expired.state, "failed");
    report.check(
      "boundaries",
      "expired photo bytes cleared",
      one(f.db, "SELECT image FROM jobs WHERE id=?", up.json().id).image,
      null,
    );
    for (let i = 0; i < 20; i++)
      await f.call("POST", "/v1/coach/messages", { text: "test" }, t);
    report.check(
      "boundaries",
      "AI daily quota",
      (await f.raw("POST", "/v1/coach/messages", { text: "test" }, t))
        .statusCode,
      429,
    );
    c.advance(86400000);
    report.check(
      "boundaries",
      "quota resets next UTC day",
      (await f.raw("POST", "/v1/coach/messages", { text: "test" }, t))
        .statusCode,
      200,
    );
    c.set("2027-01-01T05:30:00Z");
    t = (await f.signin("boundary@proteinpilot.test")).accessToken;
    for (const [instant, day] of [
      ["2027-01-01T04:59:00Z", "2026-12-31"],
      ["2027-01-01T05:01:00Z", "2027-01-01"],
    ]) {
      const m = await f.call(
        "POST",
        "/v1/meals",
        { ...makeMeal(c), loggedAt: instant },
        t,
        f.key(),
      );
      report.check("boundaries", `year ${instant}`, m.day, day);
    }
  } catch (e) {
    report.check("boundaries", "exception", (e as Error).message, "no error");
  } finally {
    await f.app.close();
  }
}
if (o.scenario === "all" || o.scenario === "rate-limits") {
  const f = await fixture(new VirtualClock(), fixedAI, true);
  try {
    const codes = [];
    for (let i = 0; i < 6; i++)
      codes.push(
        (
          await f.raw("POST", "/v1/auth/request-link", {
            email: `rate${i}@proteinpilot.test`,
          })
        ).statusCode,
      );
    report.check(
      "rate-limits",
      "real limiter sixth request",
      codes,
      [202, 202, 202, 202, 202, 429],
    );
  } finally {
    await f.app.close();
  }
}
const result = await report.save(o.out, {
  userDays,
  profiles: selected.map((p) => ({
    id: p.id,
    profile: p.profile,
    unsupported: p.extra,
  })),
  scope: "deterministic API workflows; no live nutrition accuracy claims",
});
console.log(
  JSON.stringify({
    userDays,
    counts: result.counts,
    fingerprint: result.fingerprint,
    report: o.out,
  }),
);
if (result.counts.fail) process.exitCode = 1;
