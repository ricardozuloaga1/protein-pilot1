import { readFile, writeFile, mkdir } from "node:fs/promises";
import Database from "better-sqlite3";
import path from "node:path";
import { tmpdir } from "node:os";
const [stage, expectedTarget, expectedProtein, expectedCount] =
  process.argv.slice(2);
const state = JSON.parse(
  await readFile("evaluation/private/simulator.json", "utf8"),
);
if (
  !state.dataDir.startsWith(
    path.join(tmpdir(), "protein-pilot-simulator-eval-"),
  )
)
  throw Error("Not an evaluation database");
const db = new Database(path.join(state.dataDir, "protein-pilot.sqlite"), {
  readonly: true,
});
const u: any = db
  .prepare("SELECT id,profile FROM users WHERE email=?")
  .get("onboarding-flow@proteinpilot.test");
if (!u) throw Error("Missing fictional user");
const guidance: any = db
  .prepare(
    "SELECT day,data FROM target_guidance WHERE user_id=? ORDER BY day DESC LIMIT 1",
  )
  .get(u.id);
const g = guidance ? JSON.parse(guidance.data) : null;
const meals: any[] = db
  .prepare("SELECT data FROM meals WHERE user_id=? AND deleted_at IS NULL")
  .all(u.id)
  .map((m: any) => JSON.parse(m.data));
const protein = meals.length
  ? Math.round(
      meals
        .flatMap((m) => m.foods)
        .reduce((n, f) => n + (f.grams * f.per100g.protein) / 100, 0) * 10,
    ) / 10
  : null;
const nullable = (s: string) => (s === "null" ? null : Number(s));
const checks = {
  target: g?.protein === nullable(expectedTarget),
  protein: protein === nullable(expectedProtein),
  confirmedCount: meals.length === Number(expectedCount),
};
const counts = Object.fromEntries(
  ["plans", "messages", "exports", "meal_photos"].map((t) => [
    t,
    (db.prepare(`SELECT count(*) n FROM ${t} WHERE user_id=?`).get(u.id) as any)
      .n,
  ]),
);
const result = {
  stage,
  expected: {
    target: nullable(expectedTarget),
    protein: nullable(expectedProtein),
    confirmedCount: Number(expectedCount),
  },
  actual: { target: g?.protein, protein, confirmedCount: meals.length },
  checks,
  pass: Object.values(checks).every(Boolean),
  profile: JSON.parse(u.profile),
  guidance: g,
  counts,
};
await mkdir("evaluation/onboarding", { recursive: true });
await writeFile(
  `evaluation/onboarding/${stage}.json`,
  JSON.stringify(result, null, 2),
);
db.close();
console.log(JSON.stringify({ stage, checks, actual: result.actual, counts }));
if (!result.pass) process.exitCode = 1;
