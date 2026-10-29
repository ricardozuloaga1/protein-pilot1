export function decimalValue(text: string): number | null {
  return text.trim() ? Number(text.replace(",", ".")) : null;
}
export function reconcileDecimalText(
  current: string,
  value: number | null,
): string {
  return Object.is(decimalValue(current), value) ||
    (value === 0 && current === "")
    ? current
    : value === null || value === 0
      ? ""
      : String(value);
}
