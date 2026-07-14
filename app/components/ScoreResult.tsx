"use client";

import type { ScoreResult } from "@/lib/types";
import { SignalRadar } from "./SignalRadar";

type Props = {
  result: ScoreResult;
};

function scoreLevel(score: number): { label: string; color: string } {
  if (score >= 0.8) return { label: "Highly critical", color: "text-red-600 dark:text-red-400" };
  if (score >= 0.6) return { label: "Critical", color: "text-orange-600 dark:text-orange-400" };
  if (score >= 0.4) return { label: "Moderately critical", color: "text-yellow-600 dark:text-yellow-400" };
  if (score >= 0.2) return { label: "Low criticality", color: "text-emerald-600 dark:text-emerald-400" };
  return { label: "Least critical", color: "text-zinc-500 dark:text-zinc-400" };
}

function formatRaw(key: string, value: number): string {
  if (
    key === "commit_frequency" ||
    key === "issue_comment_frequency"
  ) {
    return value.toFixed(2);
  }
  return Math.round(value).toLocaleString();
}

export function ScoreResultView({ result }: Props) {
  const { score, repo, contributions, collectedAt } = result;
  const level = scoreLevel(score);
  const pct = Math.round(score * 100);

  return (
    <section className="flex flex-col gap-6 animate-in">
      {/* Header card */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              OpenSSF Criticality Score
            </p>
            <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              <a
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                {repo.owner}/{repo.name}
              </a>
            </h2>
            {repo.description && (
              <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                {repo.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              {repo.language && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
                  {repo.language}
                </span>
              )}
              {repo.license && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
                  {repo.license}
                </span>
              )}
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
                ★ {repo.stars.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-2xl bg-zinc-50 px-8 py-5 dark:bg-zinc-950/60">
            <div className="text-5xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
              {score.toFixed(5)}
            </div>
            <div className={`mt-1 text-sm font-medium ${level.color}`}>
              {level.label}
            </div>
            <div className="mt-3 h-1.5 w-32 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">
              0 least · 1 most critical
            </p>
          </div>
        </div>
      </div>

      {/* Radar + breakdown */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-2 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Signal radar
          </h3>
          <SignalRadar contributions={contributions} score={score} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Signal breakdown
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Weighted arithmetic mean with zipfian normalization (Rob Pike /
              OpenSSF)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-5 py-2.5 font-medium">Signal</th>
                  <th className="px-3 py-2.5 font-medium text-right">Raw</th>
                  <th className="px-3 py-2.5 font-medium text-right">Norm.</th>
                  <th className="px-3 py-2.5 font-medium text-right">Weight</th>
                  <th className="px-5 py-2.5 font-medium">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((c) => (
                  <tr
                    key={c.key}
                    className="border-b border-zinc-50 last:border-0 dark:border-zinc-800/60"
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium text-zinc-800 dark:text-zinc-200">
                        {c.label}
                        {c.smallerIsBetter && (
                          <span className="ml-1 text-[10px] font-normal text-zinc-400">
                            ↓ better
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {c.description}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatRaw(c.key, c.raw)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {c.normalized.toFixed(3)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {c.weight}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{
                              width: `${Math.round(c.normalized * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs tabular-nums text-zinc-500">
                          {(c.weighted).toFixed(2)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
        Collected {new Date(collectedAt).toLocaleString()} · deps.dev disabled
        (GitHub mentions used as dependency proxy) ·{" "}
        <a
          href="https://github.com/ossf/criticality_score"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          OpenSSF criticality_score
        </a>
      </p>
    </section>
  );
}
