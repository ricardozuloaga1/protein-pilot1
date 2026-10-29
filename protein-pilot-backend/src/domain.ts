import { proteinInputs } from "./protein.js";
import { systemClock, type Clock } from "./clock.js";
import { z } from "zod";
export const id = z.string().uuid();
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return !isNaN(+d) && d.toISOString().slice(0, 10) === v;
  }, "Invalid calendar date");
export const nutrients = z.object({
  calories: z.number().min(0).max(1000),
  protein: z.number().min(0).max(100),
  carbs: z.number().min(0).max(100),
  fat: z.number().min(0).max(100),
});
export const food = z.object({
  name: z.string().trim().min(1).max(120),
  grams: z.number().positive().max(5000),
  per100g: nutrients,
  source: z.enum(["user", "photo_estimate", "catalog_estimate"]),
});
export const meal = z.object({
  name: z.string().trim().min(1).max(120),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  loggedAt: z.string().datetime({ offset: true }),
  foods: z.array(food).min(1).max(40),
  notes: z.string().max(2000).default(""),
});
export const profile = z.object({
  proteinInputs: proteinInputs.optional(),
  name: z.string().trim().min(1).max(80),
  timezone: z
    .string()
    .max(80)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }),
  goal: z.enum(["build_muscle", "maintain", "feel_stronger"]),
  weightKg: z.number().min(25).max(400).nullable(),
  diet: z.enum(["omnivore", "vegetarian", "vegan", "pescatarian"]),
  allergies: z.array(z.string().trim().min(1).max(80)).max(30),
  exclusions: z.array(z.string().trim().min(1).max(80)).max(30),
  photoConsent: z.boolean(),
});
export const defaultProfile = {
  name: "Pilot",
  timezone: "UTC",
  goal: "maintain",
  weightKg: null,
  diet: "omnivore",
  allergies: [],
  exclusions: [],
  photoConsent: false,
};
export type Food = z.infer<typeof food>;
export type Meal = z.infer<typeof meal>;
export function totals(foods: Food[]) {
  const out = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const f of foods)
    for (const key of Object.keys(out) as (keyof typeof out)[])
      out[key] += (f.per100g[key] * f.grams) / 100;
  for (const key of Object.keys(out) as (keyof typeof out)[])
    out[key] =
      Math.round(
        (out[key] + Number.EPSILON * Math.max(1, Math.abs(out[key]))) * 10,
      ) / 10;
  return out;
}
export function dayInZone(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function today(timezone: string, clock: Clock = systemClock) {
  return dayInZone(new Date(clock.now()).toISOString(), timezone);
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, code: string, message: string): never {
  throw new ApiError(status, code, message);
}
