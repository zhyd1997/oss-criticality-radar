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
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:mb-4">
        Legacy metrics
      </h3>
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

  return (
    <div
      className={`card-surface-hover flex min-h-[7.5rem] flex-col items-center justify-start rounded-xl border border-zinc-100 bg-zinc-50/50 px-2 py-3.5 text-center dark:border-zinc-800 dark:bg-zinc-900/40 sm:min-h-[8rem] sm:px-3 sm:py-4 ${
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
        className={`mt-auto pt-1 text-base font-bold tabular-nums sm:text-lg ${valueColor}`}
      >
        {formatRaw(c.key, c.raw)}
      </p>
      {c.excluded && (
        <span className="mt-1 text-[9px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
          excluded
        </span>
      )}
    </div>
  );
}
