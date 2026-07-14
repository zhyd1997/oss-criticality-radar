/**
 * OpenSSF criticality signals (original_pike / default config).
 * `null` means the signal could not be collected and is excluded from the score.
 */
export type CriticalitySignals = {
  created_since: number;
  updated_since: number;
  contributor_count: number;
  org_count: number;
  commit_frequency: number;
  recent_release_count: number;
  updated_issues_count: number;
  closed_issues_count: number;
  issue_comment_frequency: number;
  /** null when commit search is rate-limited / unavailable (weight 2 — do not fake as 0). */
  github_mention_count: number | null;
};

export type RepoMeta = {
  owner: string;
  name: string;
  url: string;
  language: string | null;
  license: string | null;
  stars: number;
  description: string | null;
};

export type SignalContribution = {
  key: keyof CriticalitySignals;
  label: string;
  raw: number | null;
  /** Normalized contribution in [0, 1] after bounds + zipfian; null if excluded. */
  normalized: number | null;
  weight: number;
  /** weight * normalized; null if excluded. */
  weighted: number | null;
  threshold: number;
  smallerIsBetter: boolean;
  description: string;
  excluded: boolean;
};

export type ScoreResult = {
  score: number;
  /** True when one or more weighted signals were unavailable and excluded. */
  partial: boolean;
  unavailableSignals: Array<keyof CriticalitySignals>;
  repo: RepoMeta;
  signals: CriticalitySignals;
  contributions: SignalContribution[];
  collectedAt: string;
};

export type ScoreErrorBody = {
  error: string;
  code?: string;
};

export function isScoreResult(value: unknown): value is ScoreResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.score === "number" &&
    typeof v.partial === "boolean" &&
    typeof v.repo === "object" &&
    v.repo !== null &&
    typeof v.signals === "object" &&
    v.signals !== null &&
    Array.isArray(v.contributions)
  );
}

export function isScoreErrorBody(value: unknown): value is ScoreErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ScoreErrorBody).error === "string"
  );
}
