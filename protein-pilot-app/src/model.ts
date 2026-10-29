import { appClock } from "./clock";
export type Macro = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};
export type Food = {
  name: string;
  grams: number;
  per100g: Macro;
  source: "user" | "photo_estimate" | "catalog_estimate";
};
export type Meal = {
  id?: string;
  version?: number;
  name: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  loggedAt: string;
  foods: Food[];
  notes: string;
  totals?: Macro;
  warnings?: string[];
  editId?: string;
  editVersion?: number;
  requestKey?: string;
  requestFingerprint?: string;
};
export type Profile = {
  proteinInputs?: {
    age: number;
    heightCm: number;
    training: "none" | "strength" | "endurance" | "mixed";
    trainingDays: number;
    guidance:
      "none" | "clinician" | "pregnancy_breastfeeding" | "prefer_not_to_say";
  };
  name: string;
  timezone: string;
  goal: string;
  weightKg: number | null;
  diet: string;
  allergies: string[];
  exclusions: string[];
  photoConsent: boolean;
};
export const initialProfile: Profile = {
  name: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  goal: "maintain",
  weightKg: null,
  diet: "omnivore",
  allergies: [],
  exclusions: [],
  photoConsent: false,
};
export const blankMeal = (): Meal => ({
  name: "My meal",
  mealType: "lunch",
  loggedAt: new Date(appClock.now()).toISOString(),
  foods: [],
  notes: "",
});
export const sum = (foods: Food[]): Macro =>
  foods.reduce(
    (n, f) => ({
      calories: n.calories + (f.grams * f.per100g.calories) / 100,
      protein: n.protein + (f.grams * f.per100g.protein) / 100,
      carbs: n.carbs + (f.grams * f.per100g.carbs) / 100,
      fat: n.fat + (f.grams * f.per100g.fat) / 100,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
export const round = (n: number) =>
  Math.round((n + Number.EPSILON * Math.max(1, Math.abs(n))) * 10) / 10;
export function localDay(
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  d = new Date(appClock.now()),
) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  return ["year", "month", "day"]
    .map((k) => p.find((v) => v.type === k)!.value)
    .join("-");
}
export const shiftDay = (day: string, n: number) =>
  new Date(Date.parse(day + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
export const prettyDay = (day: string) =>
  new Date(day + "T12:00:00").toLocaleDateString("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
export function validateMeal(m: Meal): string | undefined {
  if (!m.name.trim()) return "Give your meal a name.";
  if (!m.foods.length) return "Add at least one food.";
  if (
    !Number.isFinite(Date.parse(m.loggedAt)) ||
    Date.parse(m.loggedAt) > appClock.now() + 300000
  )
    return "Choose a valid time when you ate this meal.";
  for (const f of m.foods) {
    if (
      !f.name.trim() ||
      !Number.isFinite(f.grams) ||
      f.grams <= 0 ||
      f.grams > 5000
    )
      return "Check each food name and portion (1–5,000 g).";
    for (const [k, v] of Object.entries(f.per100g))
      if (!Number.isFinite(v) || v < 0 || v > (k === "calories" ? 1000 : 100))
        return "Check nutrition per 100 g. Values cannot be negative.";
  }
}
