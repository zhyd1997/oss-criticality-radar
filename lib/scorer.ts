import { clamp, round } from "./math";
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
 * Missing signals (null) are skipped — same as OpenSSF when a field is unset.
 *
 * score_i = log(1 + bound(S_i)) / log(1 + T_i)
 * score   = sum(α_i * score_i) / sum(α_i over present inputs)
 */

type SignalConfig = {
  key: keyof CriticalitySignals;
  label: string;
  weight: number;
  upper: number;
  lower?: number;
  smallerIsBetter?: boolean;
  /** OpenSSF README "Description" column. */
  description: string;
  /** OpenSSF README "Reasoning" column. */
  reasoning: string;
};

/**
 * Signal weights/thresholds from original_pike.yml.
 * Description + reasoning from the OpenSSF criticality_score README parameter table:
 * https://github.com/ossf/criticality_score#criticality-score
 *
 * Note: github_mention_count maps to OpenSSF's dependents_count when deps.dev is disabled
 * (commit-message mention proxy).
 */
export const SIGNAL_CONFIG: SignalConfig[] = [
  {
    key: "created_since",
    label: "Created since",
    weight: 1,
    upper: 120,
    description: "Time since the project was created (in months)",
    reasoning:
      "Older project has higher chance of being widely used or being dependent upon.",
  },
  {
    key: "updated_since",
    label: "Updated since",
    weight: 1,
    upper: 120,
    smallerIsBetter: true,
    description: "Time since the project was last updated (in months)",
    reasoning:
      "Unmaintained projects with no recent commits have higher chance of being less relied upon.",
  },
  {
    key: "contributor_count",
    label: "Contributor count",
    weight: 2,
    upper: 5000,
    description: "Count of project contributors (with commits)",
    reasoning:
      "Different contributors involvement indicates project's importance.",
  },
  {
    key: "org_count",
    label: "Org count",
    weight: 1,
    upper: 10,
    description:
      "Count of distinct organizations that contributors belong to",
    reasoning: "Indicates cross-organization dependency.",
  },
  {
    key: "commit_frequency",
    label: "Commit frequency",
    weight: 1,
    upper: 1000,
    description: "Average number of commits per week in the last year",
    reasoning:
      "Higher code churn has slight indication of project's importance. Also, higher susceptibility to vulnerabilities.",
  },
  {
    key: "recent_release_count",
    label: "Recent release count",
    weight: 0.5,
    upper: 26,
    description: "Number of releases in the last year",
    reasoning:
      "Frequent releases indicates user dependency. Lower weight since this is not always used.",
  },
  {
    key: "updated_issues_count",
    label: "Updated issues count",
    weight: 0.5,
    upper: 5000,
    description: "Number of issues updated in the last 90 days",
    reasoning:
      "Indicates high contributor involvement. Lower weight since it is dependent on project contributors.",
  },
  {
    key: "closed_issues_count",
    label: "Closed issues count",
    weight: 0.5,
    upper: 5000,
    description: "Number of issues closed in the last 90 days",
    reasoning:
      "Indicates high contributor involvement and focus on closing user issues. Lower weight since it is dependent on project contributors.",
  },
  {
    key: "issue_comment_frequency",
    label: "Issue comment frequency",
    weight: 1,
    upper: 15,
    description:
      "Average number of comments per issue in the last 90 days",
    reasoning: "Indicates high user activity and dependence.",
  },
  {
    key: "github_mention_count",
    label: "GitHub mention count",
    weight: 2,
    upper: 500000,
    description: "Number of project mentions in the commit messages",
    reasoning:
      "Indicates repository use, usually in version rolls. This parameter works across all languages, including C/C++ that don't have package dependency graphs (though hack-ish). Used as a dependents_count proxy when deps.dev is disabled.",
  },
];

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
  unavailableSignals: Array<keyof CriticalitySignals>;
} {
  let itemSum = 0;
  let itemCount = 0;
  const contributions: SignalContribution[] = [];
  const unavailableSignals: Array<keyof CriticalitySignals> = [];

  for (const cfg of SIGNAL_CONFIG) {
    const raw = signals[cfg.key];
    const lower = cfg.lower ?? 0;
    const smallerIsBetter = cfg.smallerIsBetter ?? false;

    if (raw === null || raw === undefined || Number.isNaN(raw)) {
      unavailableSignals.push(cfg.key);
      contributions.push({
        key: cfg.key,
        label: cfg.label,
        raw: null,
        normalized: null,
        weight: cfg.weight,
        weighted: null,
        threshold: cfg.upper,
        smallerIsBetter,
        description: cfg.description,
        reasoning: cfg.reasoning,
        excluded: true,
      });
      continue;
    }

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
      reasoning: cfg.reasoning,
      excluded: false,
    });
  }

  const score = itemCount === 0 ? 0 : itemSum / itemCount;
  return { score, contributions, unavailableSignals };
}

export function buildScoreResult(
  repo: RepoMeta,
  signals: CriticalitySignals,
): ScoreResult {
  const { score, contributions, unavailableSignals } = scoreSignals(signals);
  return {
    score: round(score, 5),
    partial: unavailableSignals.length > 0,
    unavailableSignals,
    repo,
    signals,
    contributions,
    collectedAt: new Date().toISOString(),
  };
}
