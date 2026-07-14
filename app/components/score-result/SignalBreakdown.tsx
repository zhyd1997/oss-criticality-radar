import type { SignalContribution } from "@/lib/types";
import { SignalRadar } from "../SignalRadar";
import { ContributionBar } from "./ContributionBar";
import { formatRaw } from "./format";
import { SignalMarks } from "./SignalMarks";

type Props = {
  contributions: SignalContribution[];
  score: number;
};

export function SignalBreakdown({ contributions, score }: Props) {
  return (
    <div className="grid animate-in-delay-2 gap-5 sm:gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
      <div className="card-surface rounded-2xl p-4 sm:rounded-3xl sm:p-5">
        <h3 className="mb-1 text-center text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Signal radar
        </h3>
        <p className="mb-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Normalized contribution per signal (0–1)
        </p>
        <SignalRadar contributions={contributions} score={score} />
      </div>

      <div className="card-surface overflow-hidden rounded-2xl sm:rounded-3xl">
        <div className="border-b border-zinc-100 px-4 py-3.5 sm:px-5 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Signal breakdown
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Weighted arithmetic mean with zipfian normalization (Rob Pike /
            OpenSSF)
          </p>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 md:hidden">
          {contributions.map((c) => (
            <MobileSignalRow key={c.key} contribution={c} />
          ))}
        </div>

        <div className="hidden overflow-x-auto scroll-thin md:block">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-[11px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-5 py-3 font-medium">Signal</th>
                <th className="px-3 py-3 font-medium text-right">Raw</th>
                <th className="px-3 py-3 font-medium text-right">Norm.</th>
                <th className="px-3 py-3 font-medium text-right">Weight</th>
                <th className="px-5 py-3 font-medium">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c) => (
                <DesktopSignalRow key={c.key} contribution={c} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MobileSignalRow({
  contribution: c,
}: {
  contribution: SignalContribution;
}) {
  return (
    <div className={`px-4 py-3.5 ${c.excluded ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {c.label}
            <SignalMarks contribution={c} className="ml-1" />
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {c.description}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
            {formatRaw(c.key, c.raw)}
          </p>
          <p className="text-[10px] text-zinc-400">
            w={c.weight}
            {c.normalized !== null && ` · n=${c.normalized.toFixed(2)}`}
          </p>
        </div>
      </div>
      <div className="mt-2.5">
        <ContributionBar contribution={c} valueWidthClass="w-9" />
      </div>
    </div>
  );
}

function DesktopSignalRow({
  contribution: c,
}: {
  contribution: SignalContribution;
}) {
  return (
    <tr
      className={`border-b border-zinc-50 last:border-0 dark:border-zinc-800/50 ${
        c.excluded ? "opacity-50" : ""
      }`}
    >
      <td className="px-5 py-3.5">
        <div className="font-medium text-zinc-800 dark:text-zinc-200">
          {c.label}
          <SignalMarks contribution={c} />
        </div>
        <div className="mt-0.5 max-w-xs text-xs leading-snug text-zinc-500 dark:text-zinc-400">
          {c.description}
        </div>
      </td>
      <td className="px-3 py-3.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
        {formatRaw(c.key, c.raw)}
      </td>
      <td className="px-3 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
        {c.normalized === null ? "—" : c.normalized.toFixed(3)}
      </td>
      <td className="px-3 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
        {c.weight}
      </td>
      <td className="px-5 py-3.5">
        <ContributionBar contribution={c} />
      </td>
    </tr>
  );
}
