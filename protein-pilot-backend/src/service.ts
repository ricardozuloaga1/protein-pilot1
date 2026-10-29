import { clockFor } from "./clock.js";
import { randomUUID } from "node:crypto";
import { type DB, all, one, run } from "./db.js";
import { fail, dayInZone, totals, type Meal } from "./domain.js";
import { hash } from "./auth.js";
export function userProfile(db: DB, uid: string) {
  return JSON.parse(
    one(db, "SELECT profile FROM users WHERE id=?", uid).profile,
  );
}
export function owned(
  db: DB,
  table: "meals" | "drafts" | "jobs" | "favorites" | "plans" | "exports",
  uid: string,
  id: string,
) {
  const row = one(
    db,
    `SELECT * FROM ${table} WHERE id=? AND user_id=?`,
    id,
    uid,
  );
  if (!row) fail(404, "not_found", "This item is not available.");
  return row;
}
export function decode(row: any) {
  return {
    id: row.id,
    ...JSON.parse(row.data),
    version: row.version,
    ...(row.day ? { day: row.day, deletedAt: row.deleted_at } : {}),
    ...(row.meal_id ? { mealId: row.meal_id } : {}),
  };
}
export function expectVersion(row: any, version: number) {
  if (row.version !== version)
    fail(
      409,
      "version_conflict",
      "This item changed. Reload it before saving.",
    );
}
export function idempotent<T>(
  db: DB,
  uid: string,
  key: string,
  scope: string,
  payload: unknown,
  action: () => T,
): T {
  const fingerprint = hash(JSON.stringify(payload));
  return db.transaction(() => {
    const prior = one(
      db,
      "SELECT * FROM operations WHERE user_id=? AND key=?",
      uid,
      key,
    );
    if (prior) {
      if (prior.scope !== scope || prior.fingerprint !== fingerprint)
        fail(
          409,
          "idempotency_conflict",
          "Use a new request key for changed content.",
        );
      return JSON.parse(prior.response) as T;
    }
    const result = action();
    run(
      db,
      "INSERT INTO operations VALUES(?,?,?,?,?)",
      uid,
      key,
      scope,
      fingerprint,
      JSON.stringify(result),
    );
    return result;
  })();
}
export function saveMeal(db: DB, uid: string, data: Meal) {
  if (new Date(data.loggedAt).getTime() > clockFor(db).now() + 5 * 60_000)
    fail(422, "future_meal", "Use a plan for future meals.");
  const mid = randomUUID();
  const day = dayInZone(data.loggedAt, userProfile(db, uid).timezone);
  const stored = { ...data, totals: totals(data.foods) };
  run(
    db,
    "INSERT INTO meals(id,user_id,data,day,created_at) VALUES(?,?,?,?,?)",
    mid,
    uid,
    JSON.stringify(stored),
    day,
    clockFor(db).now(),
  );
  return decode(owned(db, "meals", uid, mid));
}
export function summary(db: DB, uid: string, day: string) {
  const meals = all(
    db,
    "SELECT * FROM meals WHERE user_id=? AND day=? AND deleted_at IS NULL ORDER BY created_at",
    uid,
    day,
  ).map(decode);
  let target =
    one(
      db,
      "SELECT protein FROM targets WHERE user_id=? AND day<=? ORDER BY day DESC LIMIT 1",
      uid,
      day,
    )?.protein ?? null;
  const guidanceRow = one(
    db,
    "SELECT day,data FROM target_guidance WHERE user_id=? AND day<=? ORDER BY day DESC LIMIT 1",
    uid,
    day,
  );
  const legacyRow = one(
    db,
    "SELECT day FROM targets WHERE user_id=? AND day<=? ORDER BY day DESC LIMIT 1",
    uid,
    day,
  );
  const guidance =
    guidanceRow && (!legacyRow || guidanceRow.day >= legacyRow.day)
      ? JSON.parse(guidanceRow.data)
      : null;
  if (guidance) target = guidance.protein;
  const total = meals.length ? totals(meals.flatMap((m) => m.foods)) : null;
  return {
    day,
    meals,
    totals: total,
    proteinTarget: target,
    targetGuidance: guidance,
    targetReached: total !== null && target !== null && total.protein >= target,
    coverage: meals.length ? "logged_meals_only" : "no_entries",
  };
}
export function reserveAI(db: DB, uid: string, limit: number) {
  const day = new Date(clockFor(db).now()).toISOString().slice(0, 10);
  db.transaction(() => {
    const count =
      one(db, "SELECT count FROM ai_usage WHERE user_id=? AND day=?", uid, day)
        ?.count ?? 0;
    if (count >= limit)
      fail(
        429,
        "daily_ai_limit",
        "Today’s analysis and coach limit has been reached. Manual logging is still available.",
      );
    run(
      db,
      "INSERT INTO ai_usage VALUES(?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET count=count+1",
      uid,
      day,
    );
  })();
}
