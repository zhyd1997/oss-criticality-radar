import type { RepoMeta } from "@/lib/types";
import { ExternalIcon, GitHubIcon, ShieldIcon } from "../icons";
import type { ScoreLevel } from "./score-level";

type Props = {
  repo: RepoMeta;
  level: ScoreLevel;
};

export function ReportHeader({ repo, level }: Props) {
  return (
    <div className="relative overflow-hidden bg-[var(--header)] px-4 py-5 text-[var(--header-fg)] sm:px-6 sm:py-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-500/10 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <ShieldIcon className="h-5 w-5 text-emerald-300" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                OpenSSF Criticality Score
              </p>
              <h2 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                Repository snapshot:{" "}
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 transition hover:text-cyan-200"
                >
                  {repo.owner}/{repo.name}
                </a>
              </h2>
            </div>
          </div>
          {repo.description && (
            <p className="mt-2 line-clamp-2 text-sm text-slate-400 sm:max-w-xl">
              {repo.description}
            </p>
          )}
        </div>

        <span
          className={`inline-flex w-fit shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${level.badge}`}
        >
          {level.label}
        </span>
      </div>

      <a
        href={repo.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative mt-4 flex min-w-0 items-center gap-2.5 rounded-xl border border-white/10 bg-white/95 px-3 py-2.5 text-sm text-zinc-800 shadow-sm transition hover:bg-white dark:bg-zinc-100"
      >
        <GitHubIcon className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className="truncate font-mono text-xs sm:text-sm">{repo.url}</span>
        <ExternalIcon className="ml-auto h-3.5 w-3.5 shrink-0 text-zinc-400" />
      </a>
    </div>
  );
}
