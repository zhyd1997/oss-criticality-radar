/** Shared pure numeric helpers (single canonical home). */

export function round(v: number, precision: number): number {
  const m = 10 ** precision;
  return Math.round(v * m) / m;
}

export function clamp(value: number, lower: number, upper: number): number {
  if (value < lower) return lower;
  if (value > upper) return upper;
  return value;
}
