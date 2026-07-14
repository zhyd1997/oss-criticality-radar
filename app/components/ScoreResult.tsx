"use client";

import type { ScoreResult } from "@/lib/types";
import { formatDate } from "./score-result/format";
import { LegacyMetrics } from "./score-result/LegacyMetrics";
import { RepoMetadata } from "./score-result/RepoMetadata";
import { ReportHeader } from "./score-result/ReportHeader";
import { scoreLevel } from "./score-result/score-level";
import { ScorePanel } from "./score-result/ScorePanel";
import { SignalBreakdown } from "./score-result/SignalBreakdown";

type Props = {
  result: ScoreResult;
};

export function ScoreResultView({ result }: Props) {
  const { score, repo, contributions, collectedAt, partial, unavailableSignals } =
    result;
  const level = scoreLevel(score);

  return (
    <section className="flex flex-col gap-5 sm:gap-6">
      <div className="card-surface animate-in overflow-hidden rounded-2xl sm:rounded-3xl">
        <ReportHeader repo={repo} level={level} />
        <div className="grid gap-5 p-4 sm:gap-6 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <ScorePanel
            score={score}
            ringColor={level.ring}
            partial={partial}
            unavailableSignals={unavailableSignals}
          />
          <RepoMetadata repo={repo} />
        </div>
      </div>

      <LegacyMetrics contributions={contributions} />
      <SignalBreakdown contributions={contributions} score={score} />

      <p className="animate-in-delay-3 text-center text-[11px] leading-relaxed text-zinc-400 sm:text-xs dark:text-zinc-500">
        Collected {formatDate(collectedAt)} · deps.dev disabled (GitHub mentions
        used as dependency proxy) ·{" "}
        <a
          href="https://github.com/ossf/criticality_score"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-zinc-300 underline-offset-2 transition hover:text-zinc-600 dark:decoration-zinc-600 dark:hover:text-zinc-300"
        >
          OpenSSF criticality_score
        </a>
      </p>
    </section>
  );
}
