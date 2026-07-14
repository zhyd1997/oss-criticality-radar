import type { SignalContribution } from "@/lib/types";
import { formatRaw } from "./format";
import { METRIC_STYLES } from "./metric-styles";

export function LegacyMetrics({
  contributions,
}: {
  contributions: SignalContribution[];
}) {
  return (
    <div className="card-surface animate-in-delay-1 rounded-2xl p-4 sm:rounded-3xl sm:p-6">
      <div className="mb-3 sm:mb-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Legacy metrics
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          OpenSSF criticality signals — hover a tile for the full description and
          reasoning.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-5">
        {contributions.map((c) => (
          <MetricTile key={c.key} contribution={c} />
        ))}
      </div>
    </div>
  );
}

function MetricTile({ contribution: c }: { contribution: SignalContribution }) {
  const { iconBg, valueColor, Icon } = METRIC_STYLES[c.key];
  const title = `${c.description}\n\n${c.reasoning}`;

  return (
    <div
      title={title}
      className={`card-surface-hover group relative flex min-h-[8.5rem] flex-col items-center justify-start rounded-xl border border-zinc-100 bg-zinc-50/50 px-2 py-3.5 text-center dark:border-zinc-800 dark:bg-zinc-900/40 sm:min-h-[9rem] sm:px-3 sm:py-4 ${
        c.excluded ? "opacity-50" : ""
      }`}
    >
      <span
        className={`mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${iconBg}`}
      >
        <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
      </span>
      <p className="line-clamp-2 min-h-[2rem] text-[10px] font-medium leading-snug text-zinc-500 sm:text-[11px] dark:text-zinc-400">
        {c.label}
      </p>
      <p
        className={`mt-1 text-base font-bold tabular-nums sm:text-lg ${valueColor}`}
      >
        {formatRaw(c.key, c.raw)}
      </p>
      <p className="mt-1.5 line-clamp-2 text-[9px] leading-snug text-zinc-400 sm:text-[10px] dark:text-zinc-500">
        {c.description}
      </p>
      {c.excluded && (
        <span className="mt-1 text-[9px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
          excluded
        </span>
      )}
    </div>
  );
}
