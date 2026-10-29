import { recipes, suitable, catalogNotice } from "./catalog.js";
import { fail, totals, type Food } from "./domain.js";
import { estimateProtein } from "./protein.js";

export const plannerVersion = "protein-planner-2026-10-29.1";
const aliases: Record<string, string[]> = {
  soy: ["soy", "soya", "soybean", "soybeans", "tofu"],
  milk: ["milk", "dairy", "lactose", "casein", "whey", "yogurt"],
  egg: ["egg", "eggs"],
  fish: ["fish", "salmon"],
  wheat: ["wheat", "gluten", "celiac", "coeliac"],
  peanut: ["peanut", "peanuts"],
  tree_nut: [
    "tree nut",
    "tree nuts",
    "nuts",
    "almond",
    "almonds",
    "walnut",
    "walnuts",
    "cashew",
    "cashews",
  ],
  shellfish: ["shellfish", "crustacean", "crustaceans", "shrimp", "prawn"],
  sesame: ["sesame", "tahini"],
  legumes: ["legume", "legumes", "beans", "pulses"],
};
const normalize = (s: string) =>
  s.toLowerCase().trim().replace(/[-_]/g, " ").replace(/\s+/g, " ");
export function planningProfile(p: any) {
  const expand = (term: string) => {
    const n = normalize(term);
    const group = Object.entries(aliases).find(([, terms]) =>
      terms.includes(n),
    );
    if (group)
      return group[0] === "legumes"
        ? ["soy", "lentil", "chickpea", "peanut"]
        : group[1];
    // Unknown free text must not silently turn into a safety guarantee.
    if (recipes.some((r) => r.foods.some((f) => normalize(f.name).includes(n))))
      return [n];
    fail(
      422,
      "unsupported_restriction",
      `We cannot reliably match “${term}” to this recipe catalog. Use a specific ingredient or review your restrictions before generating a plan.`,
    );
  };
  return {
    ...p,
    allergies: p.allergies.flatMap(expand),
    exclusions: p.exclusions.flatMap(expand),
  };
}
export function planSignature(p: any) {
  return JSON.stringify({
    weightKg: p.weightKg,
    proteinInputs: p.proteinInputs,
    diet: p.diet,
    allergies: [...p.allergies].map(normalize).sort(),
    exclusions: [...p.exclusions].map(normalize).sort(),
  });
}
export type Selection = { day: string; mealType: string; recipeId: string };
const rawProtein = (foods: Food[]) =>
  foods.reduce((n, f) => n + (f.grams * f.per100g.protein) / 100, 0);
export function makePlan(p: any, week: string, selected?: Selection[]) {
  if (!p.proteinInputs)
    fail(
      422,
      "profile_required",
      "Complete your profile to calculate a protein target before planning.",
    );
  const guidance = estimateProtein(p);
  if (guidance.protein === null)
    fail(
      422,
      "guidance_required",
      "Your profile needs individual guidance. Automatic protein planning is unavailable; you can still log meals.",
    );
  const target = guidance.protein;
  const eligible = suitable(planningProfile(p));
  if (!eligible.length)
    fail(
      422,
      "no_matching_recipes",
      "No recipes match all your restrictions. Your restrictions have not been relaxed.",
    );
  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.parse(week) + i * 86400000).toISOString().slice(0, 10),
  );
  const slots: any[] = [];
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    let choices = selected?.filter((s) => s.day === day);
    if (choices) {
      if (
        choices.length < 3 ||
        choices.length > 4 ||
        !["breakfast", "lunch", "dinner"].every((t) =>
          choices!.some((s) => s.mealType === t),
        )
      )
        fail(
          422,
          "incomplete_day",
          "Keep breakfast, lunch and dinner in each day. A snack is optional.",
        );
      if (choices.some((s) => !eligible.some((r) => r.id === s.recipeId)))
        fail(
          422,
          "restricted_recipe",
          "A selected recipe no longer matches your restrictions. Rebuild the plan.",
        );
    } else {
      // Prefer variety and ordinary serving sizes; do not optimize for lowest calories.
      const rotated = eligible.map(
        (_, j) => eligible[(j + i) % eligible.length],
      );
      let best: typeof eligible | undefined;
      let score = Infinity;
      for (const a of rotated)
        for (const b of rotated)
          for (const c of rotated) {
            const candidate = [a, b, c];
            const factor =
              target / candidate.reduce((n, r) => n + rawProtein(r.foods), 0);
            if (factor < 0.5 || factor > 2) continue;
            const cost =
              (3 - new Set(candidate.map((r) => r.id)).size) * 10 +
              Math.abs(Math.log(factor));
            if (cost < score) {
              score = cost;
              best = candidate;
            }
          }
      if (!best)
        fail(
          422,
          "target_not_feasible",
          "This catalog cannot meet your target within our portion limits. Try more recipe options or seek individual meal-planning guidance.",
        );
      // Put the breakfast-style recipe first if present.
      best.sort(
        (a, b) =>
          Number(b.id === "yogurt-oats") - Number(a.id === "yogurt-oats"),
      );
      choices = best.map((r, j) => ({
        day,
        mealType: ["breakfast", "lunch", "dinner"][j],
        recipeId: r.id,
      }));
    }
    choices.sort(
      (a, b) =>
        ["breakfast", "lunch", "dinner", "snack"].indexOf(a.mealType) -
        ["breakfast", "lunch", "dinner", "snack"].indexOf(b.mealType),
    );
    const chosen = choices.map((s) =>
      eligible.find((r) => r.id === s.recipeId)!,
    );
    const factor = target / chosen.reduce((n, r) => n + rawProtein(r.foods), 0);
    if (factor < 0.5 || factor > 2)
      fail(
        422,
        "target_not_feasible",
        "This combination cannot meet your target within portion limits. Choose a different recipe.",
      );
    const daySlots = choices.map((s, j) => {
      const recipe = chosen[j];
      const foods = recipe.foods.map((f) => ({
        ...f,
        grams: Math.round(f.grams * factor),
      }));
      return {
        ...s,
        name: recipe.name,
        foods,
        servings: Math.round(factor * 100) / 100,
        totals: totals(foods),
      };
    });
    // Correct rounding down with at most a few whole grams, still within portion bounds.
    for (
      let n = 0;
      totals(daySlots.flatMap((s) => s.foods)).protein < target && n < 100;
      n++
    ) {
      const candidates = daySlots
        .flatMap((s, j) =>
          s.foods.map((f, k) => ({
            f,
            max: Math.floor(chosen[j].foods[k].grams * 2),
          })),
        )
        .filter((v) => v.f.grams < v.max && v.f.per100g.protein > 0)
        .sort((a, b) => b.f.per100g.protein - a.f.per100g.protein);
      if (!candidates.length) break;
      candidates[0].f.grams++;
    }
    daySlots.forEach((s) => {
      s.totals = totals(s.foods);
    });
    const protein = totals(daySlots.flatMap((s) => s.foods)).protein;
    if (protein < target || protein - target > 1)
      fail(
        422,
        "portion_rounding",
        "Could not produce a plan within the protein tolerance.",
      );
    slots.push(...daySlots);
  }
  if (selected?.some((s) => !days.includes(s.day)))
    fail(422, "invalid_plan", "Choose dates within this plan.");
  return {
    week,
    slots,
    days: days.map((day) => ({
      day,
      target,
      totals: totals(
        slots.filter((s) => s.day === day).flatMap((s) => s.foods),
      ),
    })),
    coverage: "protein_target_meals",
    plannerVersion,
    profileSignature: planSignature(p),
    targetVersion: guidance.version,
    notice:
      catalogNotice +
      " Portions are adjusted to your protein target (within 1 g after rounding). This is not a complete calorie or micronutrient prescription. Check product labels and cross-contact precautions for allergies.",
  };
}
