import type { ScoreResult, SignalContribution } from "@/lib/types";

type Props = {
  result: ScoreResult;
};

function formatRaw(
  key: SignalContribution["key"],
  value: number | null,
): string {
  if (value === null) return "—";
  if (key === "commit_frequency" || key === "issue_comment_frequency") {
    return value.toFixed(2);
  }
  return Math.round(value).toLocaleString();
}

export function ScoreResultView({ result }: Props) {
  const { score, repo, contributions, collectedAt, partial, unavailableSignals } =
    result;

  return (
    <section className="flex flex-col gap-8">
      <div className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          <a
            href={repo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            {repo.owner}/{repo.name}
          </a>
        </h2>
        {repo.description && (
          <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
            {repo.description}
          </p>
        )}
        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-4xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
            {score.toFixed(5)}
          </span>
          <span className="text-sm text-zinc-500">criticality score</span>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {[
            repo.language,
            repo.license,
            `★ ${repo.stars.toLocaleString()}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {partial && (
          <p className="mt-2 text-xs text-zinc-500">
            Partial score — excluded: {unavailableSignals.join(", ")}.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Signals
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium">Signal</th>
                <th className="px-2 py-2 font-medium text-right">Raw</th>
                <th className="px-2 py-2 font-medium text-right">Norm.</th>
                <th className="py-2 pl-2 font-medium text-right">Weight</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c) => (
                <tr
                  key={c.key}
                  className={`border-b border-zinc-100 last:border-0 dark:border-zinc-800/80 ${
                    c.excluded ? "opacity-50" : ""
                  }`}
                >
                  <td className="py-2.5 pr-4">
                    <span className="text-zinc-800 dark:text-zinc-200">
                      {c.label}
                      {c.excluded && (
                        <span className="ml-1 text-xs text-zinc-400">
                          (excluded)
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatRaw(c.key, c.raw)}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                    {c.normalized === null ? "—" : c.normalized.toFixed(3)}
                  </td>
                  <td className="py-2.5 pl-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                    {c.weight}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-zinc-400">
        Collected {new Date(collectedAt).toLocaleString()}
      </p>
    </section>
  );
}
