/**
 * Simple in-process rate limiter for the score API.
 * Protects score-service / shared GitHub credentials in single-instance deploys.
 */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const MAX_BUCKETS = 10_000;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey !== undefined) {
        buckets.delete(oldestKey);
      }
    }
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);

  if (bucket.timestamps.length >= MAX_REQUESTS) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSec = Math.max(
      1,
      Math.ceil((WINDOW_MS - (now - oldest)) / 1000),
    );
    return { ok: false, retryAfterSec };
  }

  bucket.timestamps.push(now);
  return { ok: true };
}

/** Short-lived score cache keyed by owner/name (lowercases). */
type CacheEntry = { expiresAt: number; payload: unknown };

const scoreCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60_000;
const MAX_CACHE_ENTRIES = 10_000;

export function getCachedScore<T>(owner: string, name: string): T | null {
  const key = `${owner.toLowerCase()}/${name.toLowerCase()}`;
  const entry = scoreCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    scoreCache.delete(key);
    return null;
  }
  return entry.payload as T;
}

export function setCachedScore(
  owner: string,
  name: string,
  payload: unknown,
): void {
  const key = `${owner.toLowerCase()}/${name.toLowerCase()}`;
  if (!scoreCache.has(key) && scoreCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = scoreCache.keys().next().value;
    if (oldestKey !== undefined) {
      scoreCache.delete(oldestKey);
    }
  }
  scoreCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
}
