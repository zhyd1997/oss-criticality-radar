"use client";

import { useState, type FormEvent } from "react";
import {
  isScoreErrorBody,
  isScoreResult,
  type ScoreResult,
} from "@/lib/types";
import {
  ErrorIcon,
  GitHubIcon,
  RadarIcon,
  SpinnerIcon,
} from "./icons";
import { ScoreResultView } from "./ScoreResult";

const EXAMPLES = [
  "https://github.com/kubernetes/kubernetes",
  "https://github.com/vercel/next.js",
  "https://github.com/ossf/criticality_score",
];

type FormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; result: ScoreResult };

export function ScoreForm() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function analyze(repoUrl: string) {
    const trimmed = repoUrl.trim();
    if (!trimmed) {
      setState({
        status: "error",
        message: "Please enter a GitHub repository URL",
      });
      return;
    }

    setState({ status: "loading" });

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const message = isScoreErrorBody(data)
          ? data.error
          : "Failed to compute score";
        setState({ status: "error", message });
        return;
      }

      if (!isScoreResult(data)) {
        setState({
          status: "error",
          message: "Unexpected response from score API",
        });
        return;
      }

      setState({ status: "success", result: data });
    } catch {
      setState({
        status: "error",
        message: "Network error. Please try again.",
      });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void analyze(url);
  }

  const loading = state.status === "loading";

  return (
    <div className="flex w-full flex-col gap-6 sm:gap-8">
      <form
        onSubmit={onSubmit}
        className="card-surface rounded-2xl p-4 sm:rounded-3xl sm:p-6"
      >
        <label
          htmlFor="repo-url"
          className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          GitHub repository URL
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="relative min-w-0 flex-1">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
            >
              <GitHubIcon className="h-5 w-5" />
            </span>
            <input
              id="repo-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              disabled={loading}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-11 pr-4 text-base text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/15"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:from-emerald-400 hover:to-emerald-500 hover:shadow-lg hover:shadow-emerald-600/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 sm:px-6 dark:from-emerald-500 dark:to-emerald-600 dark:shadow-emerald-900/40"
          >
            {loading ? (
              <>
                <SpinnerIcon />
                Analyzing…
              </>
            ) : (
              <>
                <RadarIcon className="h-4 w-4 opacity-90" />
                Get criticality score
              </>
            )}
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Try:
          </span>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={loading}
                onClick={() => {
                  setUrl(example);
                  void analyze(example);
                }}
                className="rounded-full border border-zinc-200 bg-zinc-50/80 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300"
              >
                {example.replace("https://github.com/", "")}
              </button>
            ))}
          </div>
        </div>
      </form>

      {state.status === "error" && (
        <div
          role="alert"
          className="animate-fade flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
        >
          <span
            aria-hidden
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300"
          >
            <ErrorIcon className="h-3.5 w-3.5" />
          </span>
          <p className="min-w-0 leading-relaxed">{state.message}</p>
        </div>
      )}

      {loading && (
        <div className="card-surface animate-fade rounded-2xl p-8 text-center sm:rounded-3xl sm:p-10">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/50">
            <SpinnerIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Collecting signals from GitHub…
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            This may take 10–30 seconds depending on the repository size and API
            rate limits.
          </p>
          <div className="mx-auto mt-5 h-1 w-40 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" />
          </div>
        </div>
      )}

      {state.status === "success" && <ScoreResultView result={state.result} />}
    </div>
  );
}
