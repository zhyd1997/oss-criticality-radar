import type { SignalContribution } from "@/lib/types";

/** Shared ↓ better / excluded badges used by mobile + desktop breakdown. */
export function SignalMarks({
  contribution: c,
  className = "ml-1.5",
}: {
  contribution: SignalContribution;
  className?: string;
}) {
  return (
    <>
      {c.smallerIsBetter && (
        <span className={`${className} text-[10px] font-normal text-zinc-400`}>
          ↓ better
        </span>
      )}
      {c.excluded && (
        <span
          className={`${className} text-[10px] font-normal text-amber-600 dark:text-amber-400`}
        >
          excluded
        </span>
      )}
    </>
  );
}
