export type ScoreLevel = {
  label: string;
  ring: string;
  badge: string;
};

export function scoreLevel(score: number): ScoreLevel {
  if (score >= 0.8)
    return {
      label: "Highly critical",
      ring: "#ef4444",
      badge:
        "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900",
    };
  if (score >= 0.6)
    return {
      label: "Critical",
      ring: "#f97316",
      badge:
        "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-900",
    };
  if (score >= 0.4)
    return {
      label: "Moderately critical",
      ring: "#eab308",
      badge:
        "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900",
    };
  if (score >= 0.2)
    return {
      label: "Low criticality",
      ring: "#10b981",
      badge:
        "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900",
    };
  return {
    label: "Least critical",
    ring: "#94a3b8",
    badge:
      "bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
  };
}

/** Radar / accent color from score magnitude. */
export function scoreAccent(score: number): string {
  if (score >= 0.7) return "#22c55e";
  if (score >= 0.4) return "#eab308";
  return "#f97316";
}
