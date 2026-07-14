/** Signals used by the OpenSSF criticality score (original_pike / default config). */
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
  github_mention_count: number;
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
  raw: number;
  /** Normalized contribution in [0, 1] after bounds + zipfian. */
  normalized: number;
  weight: number;
  /** weight * normalized */
  weighted: number;
  threshold: number;
  smallerIsBetter: boolean;
  description: string;
};

export type ScoreResult = {
  score: number;
  repo: RepoMeta;
  signals: CriticalitySignals;
  contributions: SignalContribution[];
  collectedAt: string;
};

export type ScoreError = {
  error: string;
  code?: string;
};
