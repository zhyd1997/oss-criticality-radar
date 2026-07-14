import { createGitHubClient } from "./github";
import { parseGitHubRepo } from "./parse-repo";
import {
  getCachedScore,
  setCachedScore,
} from "./rate-limit";
import {
  isScoreServiceConfigured,
  scoreViaService,
} from "./score-service-client";
import { buildScoreResult } from "./scorer";
import { collectSignals } from "./signals";
import type { ScoreResult } from "./types";

/**
 * Parse a GitHub repo URL and compute the criticality score.
 *
 * Prefer the Dockerized OpenSSF CLI backend when SCORE_SERVICE_URL is set;
 * otherwise fall back to the in-process TypeScript collector (legacy path).
 */
export async function scoreRepoUrl(url: string): Promise<ScoreResult> {
  // Validate / normalize early so cache keys and errors are consistent.
  const { owner, name, url: canonical } = parseGitHubRepo(url);

  const cached = getCachedScore<ScoreResult>(owner, name);
  if (cached) return cached;

  const result = isScoreServiceConfigured()
    ? await scoreViaService(canonical)
    : await scoreLocally(owner, name);

  setCachedScore(owner, name, result);
  return result;
}

async function scoreLocally(
  owner: string,
  name: string,
): Promise<ScoreResult> {
  const client = createGitHubClient();
  const { repo, signals } = await collectSignals(owner, name, client);
  return buildScoreResult(repo, signals);
}
