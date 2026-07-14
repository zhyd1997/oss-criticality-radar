import type { CriticalitySignals } from "@/lib/types";

const DECIMAL_KEYS = new Set<keyof CriticalitySignals>([
  "commit_frequency",
  "issue_comment_frequency",
]);

export function formatRaw(
  key: keyof CriticalitySignals,
  value: number | null,
): string {
  if (value === null) return "—";
  if (DECIMAL_KEYS.has(key)) return value.toFixed(2);
  return Math.round(value).toLocaleString();
}

/** Local collected-at display. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** OpenSSF-style UTC timestamp: 2021-12-20 02:15:12 UTC */
export function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}
