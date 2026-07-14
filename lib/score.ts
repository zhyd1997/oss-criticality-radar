import { createGitHubClient } from "./github";
import { parseGitHubRepo } from "./parse-repo";
import {
  getCachedScore,
  setCachedScore,
} from "./rate-limit";
import { buildScoreResult } from "./scorer";
import { collectSignals } from "./signals";
import type { ScoreResult } from "./types";

/**
 * Parse a GitHub repo URL, collect signals, and compute the criticality score.
 * Shared by GET and POST handlers — no synthetic Request framing.
 */
export async function scoreRepoUrl(url: string): Promise<ScoreResult> {
  const { owner, name } = parseGitHubRepo(url);

  const cached = getCachedScore<ScoreResult>(owner, name);
  if (cached) return cached;

  const client = createGitHubClient();
  const { repo, signals } = await collectSignals(owner, name, client);
  const result = buildScoreResult(repo, signals);

  setCachedScore(owner, name, result);
  return result;
}
