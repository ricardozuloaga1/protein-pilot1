import { z } from "zod";
export const proteinInputs = z
  .object({
    age: z.number().int().min(1).max(120),
    heightCm: z.number().min(100).max(230),
    training: z.enum(["none", "strength", "endurance", "mixed"]),
    trainingDays: z.number().int().min(0).max(7),
    guidance: z.enum([
      "none",
      "clinician",
      "pregnancy_breastfeeding",
      "prefer_not_to_say",
    ]),
  })
  .refine(
    (p) => (p.training === "none" ? p.trainingDays === 0 : p.trainingDays > 0),
    { message: "Training frequency must match training type" },
  );
export const estimateInput = z.object({
  weightKg: z.number().min(25).max(400),
  proteinInputs,
});
export function estimateProtein(value: unknown) {
  const input = estimateInput.parse(value),
    p = input.proteinInputs;
  const version = "protein-profile-2026-10-28.1";
  const sources = [
    "https://cdn.realfood.gov/DGA.pdf",
    "https://www.medlineplus.gov/ency/article/002458.htm",
  ];
  const bmi = input.weightKg / (p.heightCm / 100) ** 2;
  if (
    p.age < 18 ||
    p.age >= 65 ||
    p.guidance !== "none" ||
    bmi < 18.5 ||
    bmi >= 30
  ) {
    return {
      status: "needs_guidance" as const,
      protein: null,
      range: null,
      multiplier: null,
      version,
      sources,
      explanation:
        "This general adult estimate does not cover your profile. You can still log meals and browse recipes without a numeric target. A clinician or dietitian can help set an appropriate plan.",
      reason:
        p.guidance !== "none"
          ? "specialized_guidance"
          : p.age < 18 || p.age >= 65
            ? "age_scope"
            : "weight_selection_review",
    };
  }
  const regular = p.trainingDays >= 2 && p.training !== "none";
  const multiplier = regular ? (p.training === "endurance" ? 1.4 : 1.6) : 1.2;
  const protein = Math.round(input.weightKg * multiplier);
  return {
    status: "ready" as const,
    protein,
    range: {
      min: Math.round(input.weightKg * 1.2),
      max: Math.round(input.weightKg * (regular ? 2 : 1.6)),
    },
    multiplier,
    version,
    sources,
    explanation: `${input.weightKg} kg × ${multiplier} g/kg = ${protein} g/day (rounded). ${regular ? "Your regular " + p.training + " training informed the starting point." : "We used the lower end of the general adult guidance range."} This is a starting estimate, not a requirement to exceed.`,
    reason: regular ? p.training : "general_adult",
  };
}
