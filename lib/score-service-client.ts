import {
  parseCliStdoutJson,
  scoreResultFromCliJson,
} from "./criticality-cli";
import type { ScoreResult } from "./types";

export type ScoreServiceRawResponse = {
  code: number;
  stdout: string;
  stderr: string;
};

export class ScoreServiceError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly stderr?: string;

  constructor(
    message: string,
    opts: { status: number; code?: string; stderr?: string },
  ) {
    super(message);
    this.name = "ScoreServiceError";
    this.status = opts.status;
    this.code = opts.code;
    this.stderr = opts.stderr;
  }
}

function serviceBaseUrl(): string | null {
  const url = process.env.SCORE_SERVICE_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

function serviceToken(): string | undefined {
  const t = process.env.SCORE_SERVICE_TOKEN?.trim();
  return t || undefined;
}

/** True when the Next BFF should call the Dockerized score-service. */
export function isScoreServiceConfigured(): boolean {
  return serviceBaseUrl() !== null;
}

/**
 * Call score-service POST /score and map CLI JSON stdout into ScoreResult.
 * Token is server-side only (never NEXT_PUBLIC_*).
 */
export async function scoreViaService(repoUrl: string): Promise<ScoreResult> {
  const base = serviceBaseUrl();
  if (!base) {
    throw new ScoreServiceError("SCORE_SERVICE_URL is not configured", {
      status: 500,
      code: "score_service_unconfigured",
    });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = serviceToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${base}/score`, {
      method: "POST",
      headers,
      body: JSON.stringify({ repoUrl }),
      // Do not cache backend scores in Next's data cache.
      cache: "no-store",
      signal: AbortSignal.timeout(95_000),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach score-service";
    throw new ScoreServiceError(message, {
      status: 502,
      code: "score_service_unreachable",
    });
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ScoreServiceError("score-service returned non-JSON", {
      status: 502,
      code: "score_service_bad_response",
    });
  }

  if (!res.ok) {
    const errMsg =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `score-service HTTP ${res.status}`;
    throw new ScoreServiceError(errMsg, {
      status: res.status >= 400 && res.status < 600 ? res.status : 502,
      code: "score_service_http_error",
      stderr:
        typeof body === "object" &&
        body !== null &&
        "stderr" in body &&
        typeof (body as { stderr: unknown }).stderr === "string"
          ? (body as { stderr: string }).stderr
          : undefined,
    });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as ScoreServiceRawResponse).code !== "number"
  ) {
    throw new ScoreServiceError("score-service response missing code", {
      status: 502,
      code: "score_service_bad_response",
    });
  }

  const raw = body as ScoreServiceRawResponse;
  if (raw.code !== 0) {
    const detail =
      raw.stderr?.trim() ||
      raw.stdout?.trim() ||
      `criticality_score exited with code ${raw.code}`;
    throw new ScoreServiceError(detail.split("\n").slice(-3).join("\n"), {
      status: 502,
      code: "criticality_score_failed",
      stderr: raw.stderr,
    });
  }

  try {
    const json = parseCliStdoutJson(raw.stdout);
    return scoreResultFromCliJson(json, repoUrl);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to parse CLI output";
    throw new ScoreServiceError(message, {
      status: 502,
      code: "criticality_score_parse_error",
      stderr: raw.stderr,
    });
  }
}
