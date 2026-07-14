import { ScoreForm } from "./components/ScoreForm";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          OSS Criticality Radar
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          OpenSSF criticality score for any GitHub repository (0 = least
          critical, 1 = most critical).
        </p>
      </header>

      <ScoreForm />

      <footer className="mt-16 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800">
        <p>
          Algorithm by{" "}
          <a
            href="https://github.com/robpike"
            className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            Rob Pike
          </a>
          , maintained by the{" "}
          <a
            href="https://github.com/ossf/criticality_score"
            className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenSSF Securing Critical Projects WG
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
