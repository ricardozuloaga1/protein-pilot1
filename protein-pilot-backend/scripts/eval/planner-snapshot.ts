import { readFile, writeFile, mkdir } from "node:fs/promises";
import Database from "better-sqlite3";
import path from "node:path";
import { tmpdir } from "node:os";
const [stage, day, count] = process.argv.slice(2);
if (!stage || !/^\d{4}-\d{2}-\d{2}$/.test(day))
  throw Error("stage and day required");
const state = JSON.parse(
  await readFile("evaluation/private/simulator.json", "utf8"),
);
if (
  !path
    .resolve(state.dataDir)
    .startsWith(path.join(tmpdir(), "protein-pilot-simulator-eval-"))
)
  throw Error("Not evaluation");
const db = new Database(path.join(state.dataDir, "protein-pilot.sqlite"), {
  readonly: true,
});
const u: any = db
  .prepare("SELECT id,profile FROM users WHERE email=?")
  .get("onboarding-flow@proteinpilot.test");
const plans: any[] = db
  .prepare("SELECT data FROM plans WHERE user_id=?")
  .all(u.id)
  .map((r: any) => JSON.parse(r.data));
const plan = plans.find((p) => p.slots.some((s: any) => s.day === day));
const slots = plan.slots.filter((s: any) => s.day === day);
const meals: any[] = db
  .prepare(
    "SELECT data FROM meals WHERE user_id=? AND day=? AND deleted_at IS NULL",
  )
  .all(u.id, day)
  .map((r: any) => JSON.parse(r.data));
const protein = (items: any[]) =>
  Math.round(
    items
      .flatMap((i) => i.foods)
      .reduce((n, f) => n + (f.grams * f.per100g.protein) / 100, 0) * 10,
  ) / 10;
const target = plan.days.find((d: any) => d.day === day).target;
const checks = {
  target: target === 152,
  fullDay: slots.length === 3,
  withinTolerance: protein(slots) >= 152 && protein(slots) <= 153,
  noSoy: slots.every((s: any) => !JSON.stringify(s.foods).match(/soy|tofu/i)),
  confirmedCount: meals.length === Number(count),
  loggedMatchesPlan: meals.every((m) =>
    slots.some(
      (s: any) =>
        s.name === m.name &&
        JSON.stringify(s.foods) === JSON.stringify(m.foods),
    ),
  ),
};
const result = {
  stage,
  day,
  checks,
  pass: Object.values(checks).every(Boolean),
  target,
  plannedProtein: protein(slots),
  loggedProtein: meals.length ? protein(meals) : null,
  mealCount: meals.length,
  slots,
  profile: JSON.parse(u.profile),
  plannerVersion: plan.plannerVersion,
};
await mkdir("evaluation/planner", { recursive: true });
await writeFile(
  `evaluation/planner/${stage}.json`,
  JSON.stringify(result, null, 2),
);
db.close();
console.log(
  JSON.stringify({ ...result, slots: undefined, profile: undefined }),
);
if (!result.pass) process.exitCode = 1;
