"use client";

import { useState, type FormEvent } from "react";
import { parseGitHubRepo } from "@/lib/parse-repo";
import {
  isScoreErrorBody,
  isScoreResult,
  type ScoreResult,
} from "@/lib/types";
import { ScoreResultView } from "./ScoreResult";

const EXAMPLES = [
  "https://github.com/softmaple/softmaple",
  "https://github.com/vercel/next.js",
  "https://github.com/ossf/criticality_score",
];

type FormState =
  | { status: "idle" }
  | { status: "loading"; command: string }
  | { status: "error"; message: string }
  | { status: "success"; result: ScoreResult };

/** Build the CLI argv shown while score-service runs criticality_score. */
function buildCliCommand(repoUrl: string): string {
  let displayUrl = repoUrl.trim();
  try {
    displayUrl = parseGitHubRepo(displayUrl).url;
  } catch {
    // Keep the raw input if parsing fails; the API will validate.
  }
  return [
    "criticality_score",
    "-depsdev-disable",
    "-format",
    "json",
    "-log",
    "error",
    displayUrl,
  ].join(" ");
}

export function ScoreForm() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function analyze(repoUrl: string) {
    const trimmed = repoUrl.trim();
    if (!trimmed) {
      setState({
        status: "error",
        message: "Please enter a GitHub repository (owner/repo or URL)",
      });
      return;
    }

    setState({ status: "loading", command: buildCliCommand(trimmed) });

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
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          GitHub repository
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="repo-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="owner/repo or https://github.com/owner/repo"
            disabled={loading}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Get score
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
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
              className="underline underline-offset-2 hover:text-zinc-800 disabled:opacity-50 dark:hover:text-zinc-200"
            >
              {example.replace("https://github.com/", "")}
            </button>
          ))}
        </div>
      </form>

      {state.status === "error" && (
        <p
          role="alert"
          className="border-l-2 border-zinc-900 pl-3 text-sm font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-50"
        >
          {state.message}
        </p>
      )}

      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 text-zinc-100 dark:border-zinc-800"
        >
          <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
            <span className="size-2.5 rounded-full bg-red-500/80" aria-hidden />
            <span
              className="size-2.5 rounded-full bg-amber-400/80"
              aria-hidden
            />
            <span
              className="size-2.5 rounded-full bg-emerald-500/80"
              aria-hidden
            />
            <span className="ml-2 text-xs text-zinc-500">score-service</span>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500">
              <span
                className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400"
                aria-hidden
              />
              running
            </span>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed sm:text-sm">
            <span className="select-none text-emerald-400">$ </span>
            <span className="text-zinc-100">{state.command}</span>
            <span
              className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-zinc-100 align-middle"
              aria-hidden
            />
          </pre>
          <p className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500">
            Collecting OpenSSF Criticality Score signals… this may take up to a
            minute.
          </p>
        </div>
      )}

      {state.status === "success" && <ScoreResultView result={state.result} />}
    </div>
  );
}
