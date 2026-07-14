import { ScoreForm } from "./components/ScoreForm";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      {/* Ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl sm:h-96 sm:w-96 dark:bg-emerald-500/10" />
        <div className="absolute -right-24 top-32 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl sm:h-96 sm:w-96 dark:bg-cyan-500/10" />
        <div className="absolute bottom-0 left-1/2 h-64 w-[min(100%,48rem)] -translate-x-1/2 rounded-full bg-violet-400/10 blur-3xl dark:bg-violet-500/5" />
        <div
          className="absolute inset-0 opacity-[0.4] dark:opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.45) 1px, transparent 0)",
            backgroundSize: "28px 28px",
            maskImage:
              "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
          }}
        />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <header className="mb-8 text-center sm:mb-10 lg:mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm backdrop-blur-sm dark:border-emerald-800/50 dark:bg-emerald-950/60 dark:text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Powered by OpenSSF criticality_score
          </div>

          <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl md:text-5xl dark:text-zinc-50">
            OSS Criticality{" "}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 bg-clip-text text-transparent dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400">
              Radar
            </span>
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-zinc-600 sm:mt-4 sm:text-base md:text-lg dark:text-zinc-400">
            Paste a GitHub repository URL to see its{" "}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
              OpenSSF criticality score
            </strong>{" "}
            — no CLI required. Scores range from 0 (least critical) to 1 (most
            critical).
          </p>
        </header>

        <ScoreForm />

        <footer className="mt-12 border-t border-zinc-200/80 pt-6 sm:mt-16 dark:border-zinc-800">
          <p className="mx-auto max-w-3xl text-center text-[11px] leading-relaxed text-zinc-500 sm:text-xs dark:text-zinc-500">
            Algorithm by{" "}
            <a
              href="https://github.com/robpike"
              className="font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 transition hover:text-emerald-700 hover:decoration-emerald-400 dark:text-zinc-400 dark:decoration-zinc-600 dark:hover:text-emerald-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              Rob Pike
            </a>
            , maintained by the{" "}
            <a
              href="https://github.com/ossf/criticality_score"
              className="font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 transition hover:text-emerald-700 hover:decoration-emerald-400 dark:text-zinc-400 dark:decoration-zinc-600 dark:hover:text-emerald-400"
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
