// Independent evaluation arithmetic: never import the application's nutrition helpers.
export function imageMetrics(
  foods: any[],
  reference: { grams: number; protein: number; calories: number },
) {
  const estimate = foods.reduce(
    (n, f) => ({
      grams: n.grams + f.grams,
      protein: n.protein + (f.grams * f.per100g.protein) / 100,
      calories: n.calories + (f.grams * f.per100g.calories) / 100,
    }),
    { grams: 0, protein: 0, calories: 0 },
  );
  const errors = {
    grams: estimate.grams - reference.grams,
    protein: estimate.protein - reference.protein,
    calories: estimate.calories - reference.calories,
  };
  return {
    rawEstimate: estimate,
    reference,
    errors,
    reviewRequired:
      Math.abs(errors.protein) > Math.max(5, reference.protein * 0.2) ||
      Math.abs(errors.calories) > Math.max(50, reference.calories * 0.2),
    correctedResult: null,
  };
}
