import type { GitHubClient } from "./client";
import { GitHubError, parseLastPage } from "./client";

/**
 * Structured list-count result — one policy model for overflow / empty / exact.
 * Replaces ad-hoc 403/5xx/too_many dialects across collectors.
 */
export type CountResult =
  | { kind: "exact"; value: number }
  | { kind: "capped"; value: number; reason: string }
  | { kind: "empty"; value: 0 }
  | { kind: "unavailable"; reason: string };

export type CountOverflowPolicy =
  | { mode: "cap"; value: number; reason: string }
  | { mode: "unavailable"; reason: string };

export type CountListOptions = {
  /**
   * How to treat GitHub overflow (403 "too large", or 5xx on huge issue lists).
   * Default: rethrow.
   */
  onOverflow?: CountOverflowPolicy;
  /** Cap exact counts at this maximum (e.g. OpenSSF MaxContributorLimit). */
  maxExact?: number;
  headers?: Record<string, string>;
};

function isOverflowError(err: unknown): boolean {
  if (!(err instanceof GitHubError)) return false;
  if (err.status >= 500 && err.status < 600) return true;
  if (err.status === 403 && err.message.toLowerCase().includes("too large")) {
    return true;
  }
  return false;
}

function isEmptyError(err: unknown): boolean {
  return (
    err instanceof GitHubError && (err.status === 204 || err.status === 404)
  );
}

/**
 * Count items on a GitHub list endpoint via Link: last + per_page=1.
 * Single implementation for contributors / issues / comments.
 */
export async function countViaLinkHeader(
  client: GitHubClient,
  path: string,
  options: CountListOptions = {},
): Promise<CountResult> {
  try {
    const { data, headers } = await client.rest<unknown[]>(path, {
      headers: options.headers,
    });

    const last = parseLastPage(headers.get("link"));
    const value =
      last === null ? (Array.isArray(data) ? data.length : 0) : last;

    if (value === 0) {
      return { kind: "empty", value: 0 };
    }

    if (options.maxExact !== undefined && value > options.maxExact) {
      return {
        kind: "capped",
        value: options.maxExact,
        reason: "max_exact",
      };
    }

    return { kind: "exact", value };
  } catch (err) {
    if (isEmptyError(err)) {
      return { kind: "empty", value: 0 };
    }

    if (isOverflowError(err) && options.onOverflow) {
      if (options.onOverflow.mode === "cap") {
        return {
          kind: "capped",
          value: options.onOverflow.value,
          reason: options.onOverflow.reason,
        };
      }
      return {
        kind: "unavailable",
        reason: options.onOverflow.reason,
      };
    }

    throw err;
  }
}
