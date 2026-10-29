import type { Food } from "./domain.js";
type Recipe = {
  id: string;
  name: string;
  diet: string[];
  allergens: string[];
  minutes: number;
  foods: Food[];
  instructions: string[];
};
const f = (
  name: string,
  grams: number,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
): Food => ({
  name,
  grams,
  per100g: { calories, protein, carbs, fat },
  source: "catalog_estimate",
});
// Starter estimates for development, not a verified food database. Package labels and recipes vary.
export const foods = [
  f("Plain Greek yogurt", 200, 59, 10, 3.6, 0.4),
  f("Cooked chicken breast", 150, 165, 31, 0, 3.6),
  f("Firm tofu", 200, 144, 17, 3, 9),
  f("Cooked lentils", 200, 116, 9, 20, 0.4),
  f("Cooked salmon", 150, 206, 22, 0, 12),
  f("Cooked eggs", 100, 155, 13, 1.1, 11),
  f("Cooked chickpeas", 200, 164, 8.9, 27, 2.6),
  f("Cooked brown rice", 150, 123, 2.7, 26, 1),
  f("Broccoli", 100, 35, 2.4, 7, 0.4),
  f("Oats", 50, 389, 17, 66, 7),
  f("Blueberries", 80, 57, 0.7, 14, 0.3),
];
const omnivore = ["omnivore"];
const fish = ["omnivore", "pescatarian"];
const vegetarian = [...fish, "vegetarian"];
const vegan = [...vegetarian, "vegan"];
export const recipes: Recipe[] = [
  {
    id: "yogurt-oats",
    name: "Yogurt, oats & berries",
    diet: vegetarian,
    allergens: ["milk", "dairy", "gluten", "wheat"],
    minutes: 5,
    foods: [foods[0], foods[9], foods[10]],
    instructions: [
      "Combine yogurt and oats.",
      "Top with berries. Check oat labeling for gluten cross-contact.",
    ],
  },
  {
    id: "chicken-rice",
    name: "Chicken & brown rice bowl",
    diet: omnivore,
    allergens: [],
    minutes: 20,
    foods: [foods[1], foods[7], foods[8]],
    instructions: [
      "Use fully cooked chicken and rice.",
      "Warm with broccoli and season to taste.",
    ],
  },
  {
    id: "tofu-rice",
    name: "Tofu & broccoli bowl",
    diet: vegan,
    allergens: ["soy"],
    minutes: 20,
    foods: [foods[2], foods[7], foods[8]],
    instructions: [
      "Cook tofu and broccoli until ready.",
      "Serve over cooked rice. Add any oil or sauce to your log separately.",
    ],
  },
  {
    id: "lentil-bowl",
    name: "Lentil & rice bowl",
    diet: vegan,
    allergens: [],
    minutes: 15,
    foods: [foods[3], foods[7], foods[8]],
    instructions: [
      "Warm cooked lentils and rice.",
      "Add broccoli and season to taste.",
    ],
  },
  {
    id: "salmon-bowl",
    name: "Salmon & broccoli bowl",
    diet: fish,
    allergens: ["fish", "salmon"],
    minutes: 25,
    foods: [foods[4], foods[7], foods[8]],
    instructions: [
      "Cook salmon thoroughly.",
      "Serve with cooked rice and broccoli.",
    ],
  },
  {
    id: "egg-bowl",
    name: "Egg & rice bowl",
    diet: vegetarian,
    allergens: ["egg", "eggs"],
    minutes: 15,
    foods: [foods[5], foods[7], foods[8]],
    instructions: [
      "Cook eggs to your preference and safe doneness.",
      "Serve with rice and broccoli.",
    ],
  },
  {
    id: "chickpea-bowl",
    name: "Chickpea & lentil bowl",
    diet: vegan,
    allergens: [],
    minutes: 15,
    foods: [foods[6], foods[3], foods[8]],
    instructions: [
      "Warm cooked chickpeas and lentils.",
      "Add broccoli and season to taste.",
    ],
  },
];
export const catalogNotice =
  "Starter nutrition estimates. Verify portions, labels, ingredients and allergens. Added oils and sauces are not included.";
export function suitable(profile: {
  diet: string;
  allergies: string[];
  exclusions: string[];
}) {
  const restrictions = [...profile.allergies, ...profile.exclusions].map((s) =>
    s.toLowerCase().trim(),
  );
  return recipes.filter(
    (r) =>
      r.diet.includes(profile.diet) &&
      !restrictions.some((term) =>
        [
          ...r.allergens,
          ...r.foods.map((f) => f.name.toLowerCase()),
          r.name.toLowerCase(),
        ].some((text) => text.includes(term) || term.includes(text)),
      ),
  );
}
