"use client";

import { useState, type FormEvent } from "react";
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
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          GitHub repository URL
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="repo-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
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
        <p className="text-sm text-zinc-500">
          Collecting signals from GitHub… this may take 10–30 seconds.
        </p>
      )}

      {state.status === "success" && <ScoreResultView result={state.result} />}
    </div>
  );
}
