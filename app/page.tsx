import { ScoreForm } from "./components/ScoreForm";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      {/* Background grid / glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl dark:bg-emerald-500/10" />
        <div className="absolute -right-32 top-40 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl dark:bg-cyan-500/10" />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.15]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(161 161 170 / 0.35) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-10 text-center sm:mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Powered by OpenSSF criticality_score
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
            OSS Criticality{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-cyan-400">
              Radar
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">
            Paste a GitHub repository URL to see its{" "}
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">
              OpenSSF criticality score
            </strong>{" "}
            — no CLI required. Scores range from 0 (least critical) to 1 (most
            critical).
          </p>
        </header>

        <ScoreForm />

        <footer className="mt-16 border-t border-zinc-200/80 pt-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
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
            . This app collects signals via the GitHub API and applies the same
            weights and zipfian normalization (deps.dev disabled).
          </p>
        </footer>
      </main>
    </div>
  );
}
