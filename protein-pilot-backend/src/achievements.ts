import { all, type DB } from "./db.js";
export const achievementRules = "field-notes-1";
export function achievements(db: DB, uid: string) {
  const dates = all(
    db,
    "SELECT DISTINCT day FROM meals WHERE user_id=? AND deleted_at IS NULL ORDER BY day",
    uid,
  ).map((r) => r.day as string);
  const nums = dates.map((d) => Date.parse(d) / 86400000);
  const windowMax = (length: number) => {
    let left = 0,
      best = 0;
    for (let right = 0; right < nums.length; right++) {
      while (nums[right] - nums[left] >= length) left++;
      best = Math.max(best, right - left + 1);
    }
    return best;
  };
  const homecoming = nums.some((n, i) => i > 0 && n - nums[i - 1] >= 4);
  const validPlan = all(db, "SELECT data FROM plans WHERE user_id=?", uid).some(
    (row) => {
      const p = JSON.parse(row.data);
      return (
        p.coverage === "protein_target_meals" &&
        p.profileSignature &&
        p.days?.length === 7 &&
        p.days.every(
          (d: any) =>
            d.target > 0 &&
            d.totals.protein >= d.target &&
            d.totals.protein <= d.target + 1 &&
            ["breakfast", "lunch", "dinner"].every((t) =>
              p.slots.some((s: any) => s.day === d.day && s.mealType === t),
            ),
        )
      );
    },
  );
  const rules = [
    ["seedling", dates.length ? 1 : 0, 1],
    ["seven-days", dates.length, 7],
    ["rhythm", windowMax(7), 5],
    ["rooted", windowMax(28), 20],
    ["homecoming", homecoming ? 1 : 0, 1],
    ["mise-en-place", validPlan ? 1 : 0, 1],
  ] as const;
  return {
    ruleVersion: achievementRules,
    coverage: "confirmed_history",
    items: rules.map(([id, progress, goal]) => ({
      id,
      progress: Math.min(progress, goal),
      goal,
      earned: progress >= goal,
    })),
  };
}
