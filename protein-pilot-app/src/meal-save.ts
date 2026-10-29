import type { Meal } from "./model";
export type Request = <T = any>(
  path: string,
  method?: string,
  body?: unknown,
  key?: string,
) => Promise<T>;
export const mealPayload = (m: Meal) => ({
  name: m.name,
  mealType: m.mealType,
  loggedAt: m.loggedAt,
  foods: m.foods,
  notes: m.notes,
});
// Recover lost responses by checking the existing resource before repeating a mutation.
export async function saveRemoteMeal(
  request: Request,
  draft: Meal,
  key: string,
) {
  const value = mealPayload(draft);
  if (draft.editId) {
    const current = await request(`/v1/meals/${draft.editId}`);
    if (JSON.stringify(mealPayload(current)) === JSON.stringify(value))
      return current;
    return request(`/v1/meals/${draft.editId}`, "PATCH", {
      ...value,
      version: draft.editVersion,
    });
  }
  if (!draft.id) return request("/v1/meals", "POST", value, key);
  const current = await request(`/v1/drafts/${draft.id}`);
  if (current.mealId) return request(`/v1/meals/${current.mealId}`);
  const unchanged =
    JSON.stringify(mealPayload(current)) === JSON.stringify(value);
  const updated = unchanged
    ? current
    : await request(`/v1/drafts/${draft.id}`, "PUT", {
        ...value,
        version: draft.version,
      });
  return request(
    `/v1/drafts/${draft.id}/confirm`,
    "POST",
    { version: updated.version, reviewed: true },
    `confirm-${draft.id}-${updated.version}`,
  );
}
