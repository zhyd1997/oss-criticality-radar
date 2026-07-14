"use client";

import { useState, type FormEvent } from "react";
import {
  isScoreErrorBody,
  isScoreResult,
  type ScoreResult,
} from "@/lib/types";
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
    <div className="flex w-full flex-col gap-8">
      <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
        <label
          htmlFor="repo-url"
          className="text-sm font-medium text-zinc-600 dark:text-zinc-400"
        >
          GitHub repository URL
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="repo-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            disabled={loading}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-emerald-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            {loading ? (
              <>
                <Spinner />
                Analyzing…
              </>
            ) : (
              "Get criticality score"
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>Try:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              disabled={loading}
              onClick={() => {
                setUrl(example);
                void analyze(example);
              }}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800/60 dark:hover:border-emerald-700 dark:hover:bg-emerald-950 dark:hover:text-emerald-300"
            >
              {example.replace("https://github.com/", "")}
            </button>
          ))}
        </div>
      </form>

      {state.status === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
        >
          {state.message}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-zinc-200 bg-white/60 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center">
            <Spinner className="h-8 w-8 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Collecting signals from GitHub…
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            This may take 10–30 seconds depending on the repository size.
          </p>
        </div>
      )}

      {state.status === "success" && <ScoreResultView result={state.result} />}
    </div>
  );
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
