/** Shared pure numeric helpers (single canonical home). */

export function round(v: number, precision: number): number {
  const m = 10 ** precision;
  return Math.round(v * m) / m;
}

/** Months between two dates using a 30-day month (OpenSSF SinceDuration). */
export function monthsBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 30));
}

export function clamp(value: number, lower: number, upper: number): number {
  if (value < lower) return lower;
  if (value > upper) return upper;
  return value;
}
