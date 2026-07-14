import { parseGitHubRepo } from "./parse-repo";
import { getCachedScore, setCachedScore } from "./rate-limit";
import { scoreViaService } from "./score-service-client";
import type { ScoreResult } from "./types";

/**
 * Parse a GitHub repo URL and compute the criticality score via score-service
 * (OpenSSF criticality_score CLI). Shared by GET and POST /api/score.
 */
export async function scoreRepoUrl(url: string): Promise<ScoreResult> {
  const { owner, name, url: canonical } = parseGitHubRepo(url);

  const cached = getCachedScore<ScoreResult>(owner, name);
  if (cached) return cached;

  const result = await scoreViaService(canonical);
  setCachedScore(owner, name, result);
  return result;
}
