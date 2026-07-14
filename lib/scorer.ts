import type {
  CriticalitySignals,
  ScoreResult,
  SignalContribution,
  RepoMeta,
} from "./types";

/**
 * Rob Pike weighted arithmetic mean with zipfian normalization.
 * Matches ossf/criticality_score original_pike.yml / default_config.yml.
 *
 * score_i = log(1 + bound(S_i)) / log(1 + T_i)
 * score   = sum(α_i * score_i) / sum(α_i)
 */

type SignalConfig = {
  key: keyof CriticalitySignals;
  label: string;
  weight: number;
  upper: number;
  lower?: number;
  smallerIsBetter?: boolean;
  description: string;
};

export const SIGNAL_CONFIG: SignalConfig[] = [
  {
    key: "created_since",
    label: "Created since",
    weight: 1,
    upper: 120,
    description: "Months since the project was created",
  },
  {
    key: "updated_since",
    label: "Updated since",
    weight: 1,
    upper: 120,
    smallerIsBetter: true,
    description: "Months since the last commit (lower is better)",
  },
  {
    key: "contributor_count",
    label: "Contributors",
    weight: 2,
    upper: 5000,
    description: "Count of project contributors with commits",
  },
  {
    key: "org_count",
    label: "Organizations",
    weight: 1,
    upper: 10,
    description: "Distinct organizations among top contributors",
  },
  {
    key: "commit_frequency",
    label: "Commit frequency",
    weight: 1,
    upper: 1000,
    description: "Average commits per week over the last year",
  },
  {
    key: "recent_release_count",
    label: "Recent releases",
    weight: 0.5,
    upper: 26,
    description: "Releases in the last year",
  },
  {
    key: "updated_issues_count",
    label: "Updated issues",
    weight: 0.5,
    upper: 5000,
    description: "Issues updated in the last 90 days",
  },
  {
    key: "closed_issues_count",
    label: "Closed issues",
    weight: 0.5,
    upper: 5000,
    description: "Issues closed in the last 90 days",
  },
  {
    key: "issue_comment_frequency",
    label: "Comment frequency",
    weight: 1,
    upper: 15,
    description: "Average comments per issue in the last 90 days",
  },
  {
    key: "github_mention_count",
    label: "GitHub mentions",
    weight: 2,
    upper: 500000,
    description: "Commit-message mentions of this repository",
  },
];

function clamp(value: number, lower: number, upper: number): number {
  if (value < lower) return lower;
  if (value > upper) return upper;
  return value;
}

/** Zipfian: log(1 + v) — same as criticality_score distribution "zipfian". */
function zipfian(v: number): number {
  return Math.log(1 + v);
}

/**
 * Normalize a single signal to [0, 1] using bounds + zipfian distribution.
 * Mirrors algorithm.Input.Value in criticality_score.
 */
export function normalizeSignal(
  raw: number,
  upper: number,
  lower = 0,
  smallerIsBetter = false,
): number {
  let v = clamp(raw, lower, upper);
  v = v - lower;
  const threshold = upper - lower;
  if (smallerIsBetter) {
    v = threshold - v;
  }
  const den = zipfian(threshold);
  if (den === 0) return 0;
  return zipfian(v) / den;
}

export function scoreSignals(signals: CriticalitySignals): {
  score: number;
  contributions: SignalContribution[];
} {
  let itemSum = 0;
  let itemCount = 0;
  const contributions: SignalContribution[] = [];

  for (const cfg of SIGNAL_CONFIG) {
    const raw = signals[cfg.key];
    const lower = cfg.lower ?? 0;
    const smallerIsBetter = cfg.smallerIsBetter ?? false;
    const normalized = normalizeSignal(raw, cfg.upper, lower, smallerIsBetter);
    const weighted = cfg.weight * normalized;

    itemSum += weighted;
    itemCount += cfg.weight;

    contributions.push({
      key: cfg.key,
      label: cfg.label,
      raw,
      normalized,
      weight: cfg.weight,
      weighted,
      threshold: cfg.upper,
      smallerIsBetter,
      description: cfg.description,
    });
  }

  const score = itemCount === 0 ? 0 : itemSum / itemCount;
  return { score, contributions };
}

export function buildScoreResult(
  repo: RepoMeta,
  signals: CriticalitySignals,
): ScoreResult {
  const { score, contributions } = scoreSignals(signals);
  return {
    score: round(score, 5),
    repo,
    signals,
    contributions,
    collectedAt: new Date().toISOString(),
  };
}

export function round(v: number, p: number): number {
  const m = 10 ** p;
  return Math.round(v * m) / m;
}
