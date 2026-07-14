import { parseGitHubRepo } from "./parse-repo";
import { round } from "./math";
import { scoreSignals } from "./scorer";
import type { CriticalitySignals, RepoMeta, ScoreResult } from "./types";

/**
 * Shape of `criticality_score -format json` stdout (one object per repo).
 * Score is a string in the CLI output (e.g. "0.30137").
 */
export type CriticalityCliJson = {
  default_score?: string | number;
  legacy?: Partial<Record<keyof CriticalitySignals, number | null>>;
  repo?: {
    url?: string;
    language?: string | null;
    license?: string | null;
    star_count?: number;
    created_at?: string;
    updated_at?: string;
  };
};

const SIGNAL_KEYS: Array<keyof CriticalitySignals> = [
  "created_since",
  "updated_since",
  "contributor_count",
  "org_count",
  "commit_frequency",
  "recent_release_count",
  "updated_issues_count",
  "closed_issues_count",
  "issue_comment_frequency",
  "github_mention_count",
];

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

/**
 * Parse a single JSON object from criticality_score stdout into ScoreResult.
 * Uses OpenSSF default_score when present; builds signal table via local weights.
 */
export function scoreResultFromCliJson(
  raw: unknown,
  fallbackRepoUrl: string,
): ScoreResult {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("criticality_score returned non-object JSON");
  }
  const data = raw as CriticalityCliJson;
  const legacy = data.legacy ?? {};

  // scoreSignals treats null as unavailable (excluded from the mean).
  const bag: Partial<Record<keyof CriticalitySignals, number | null>> = {};
  for (const key of SIGNAL_KEYS) {
    bag[key] = optionalNumber(legacy[key]);
  }
  const signals = bag as CriticalitySignals;

  const repoUrl =
    typeof data.repo?.url === "string" && data.repo.url
      ? data.repo.url
      : fallbackRepoUrl;
  const parsed = parseGitHubRepo(repoUrl);

  const repo: RepoMeta = {
    owner: parsed.owner,
    name: parsed.name,
    url: parsed.url,
    language: data.repo?.language ?? null,
    license: data.repo?.license ?? null,
    stars: typeof data.repo?.star_count === "number" ? data.repo.star_count : 0,
    description: null,
  };

  const { score: localScore, contributions, unavailableSignals } =
    scoreSignals(signals);

  let score = localScore;
  if (data.default_score !== undefined && data.default_score !== "") {
    const fromCli = Number(data.default_score);
    if (!Number.isNaN(fromCli)) {
      score = fromCli;
    }
  }

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

/** Extract the first JSON object from CLI stdout (logs may mix on some versions). */
export function parseCliStdoutJson(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("criticality_score produced empty stdout");
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("criticality_score stdout is not valid JSON");
    }
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  }
}
