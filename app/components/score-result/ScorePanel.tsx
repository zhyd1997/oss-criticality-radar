"use client";

import { useId } from "react";
import type { CriticalitySignals } from "@/lib/types";

type Props = {
  score: number;
  ringColor: string;
  partial: boolean;
  unavailableSignals: Array<keyof CriticalitySignals>;
};

export function ScorePanel({
  score,
  ringColor,
  partial,
  unavailableSignals,
}: Props) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-8 text-white sm:px-6 sm:py-10 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgb(16 185 129 / 0.25), transparent 50%), radial-gradient(circle at 80% 80%, rgb(6 182 212 / 0.2), transparent 45%)",
        }}
      />

      <div className="relative flex w-full flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
        <ScoreGauge score={score} ringColor={ringColor} />

        <div className="max-w-[16rem] text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Default score
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            The OpenSSF criticality score ranges from 0 to 1. Higher scores
            indicate greater criticality.
          </p>
          {partial && (
            <p className="mt-3 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs text-amber-200 ring-1 ring-amber-500/30">
              Partial score — excluded: {unavailableSignals.join(", ")}
            </p>
          )}
        </div>
      </div>

      <div className="relative mt-6 w-full max-w-xs px-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 transition-all duration-700"
            style={{ width: `${Math.min(100, Math.round(score * 100))}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] font-medium tabular-nums text-slate-500">
          <span>0</span>
          <span>1</span>
        </div>
      </div>
    </div>
  );
}

function ScoreGauge({
  score,
  ringColor,
}: {
  score: number;
  ringColor: string;
}) {
  const gradId = useId().replace(/:/g, "");
  const size = 168;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(1, Math.max(0, score));
  const offset = circumference * (1 - progress);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Criticality score ${score.toFixed(5)}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="50%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor={ringColor} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(255 255 255 / 0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
          {score.toFixed(5)}
        </span>
        <span className="mt-0.5 text-[11px] font-medium text-slate-400">
          Default score
        </span>
      </div>
    </div>
  );
}
