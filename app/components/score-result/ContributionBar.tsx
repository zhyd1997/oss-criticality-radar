import type { SignalContribution } from "@/lib/types";

type Props = {
  contribution: SignalContribution;
  /** Width class for the weighted numeric label. */
  valueWidthClass?: string;
};

/** Shared normalized contribution bar + weighted value. */
export function ContributionBar({
  contribution: c,
  valueWidthClass = "w-10",
}: Props) {
  const pct = Math.round((c.normalized ?? 0) * 100);

  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            c.excluded
              ? "bg-zinc-400"
              : "bg-gradient-to-r from-emerald-500 to-teal-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`${valueWidthClass} text-right text-xs tabular-nums text-zinc-500`}
      >
        {c.weighted === null ? "—" : c.weighted.toFixed(2)}
      </span>
    </div>
  );
}
