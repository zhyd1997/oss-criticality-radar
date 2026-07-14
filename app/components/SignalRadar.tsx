"use client";

import { useId } from "react";
import type { SignalContribution } from "@/lib/types";
import { scoreAccent } from "./score-result/score-level";

type Props = {
  contributions: SignalContribution[];
  score: number;
};

/**
 * SVG radar chart of normalized signal contributions (0–1).
 * Excluded signals plot at the origin. Scales responsively via viewBox.
 */
export function SignalRadar({ contributions, score }: Props) {
  const uid = useId().replace(/:/g, "");
  const glowId = `${uid}-glow`;
  const fillId = `${uid}-fill`;

  const n = contributions.length;
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 40;

  const angleAt = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  const point = (i: number, r: number) => {
    const a = angleAt(i);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const dataPoints = contributions.map((c, i) =>
    point(i, (c.normalized ?? 0) * maxR),
  );
  const polygon = dataPoints.map(([x, y]) => `${x},${y}`).join(" ");
  const accent = scoreAccent(score);

  return (
    <div className="relative mx-auto flex w-full max-w-[300px] items-center justify-center sm:max-w-[320px]">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-auto w-full text-zinc-900 dark:text-zinc-100"
        role="img"
        aria-label={`Radar chart of criticality signals, score ${score.toFixed(3)}`}
      >
        <defs>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={fillId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.12" />
          </linearGradient>
        </defs>

        <circle cx={cx} cy={cy} r={maxR} fill={`url(#${glowId})`} />

        {rings.map((ring) => (
          <polygon
            key={ring}
            points={Array.from({ length: n }, (_, i) => {
              const [x, y] = point(i, ring * maxR);
              return `${x},${y}`;
            }).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        ))}

        {contributions.map((_, i) => {
          const [x, y] = point(i, maxR);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          );
        })}

        <polygon
          points={polygon}
          fill={`url(#${fillId})`}
          stroke={accent}
          strokeWidth={2}
          strokeLinejoin="round"
          className="transition-all duration-500"
        />

        {dataPoints.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={3.5}
            fill={contributions[i]?.excluded ? "#a1a1aa" : accent}
            stroke="var(--card)"
            strokeWidth={1.5}
          />
        ))}

        {contributions.map((c, i) => {
          const [x, y] = point(i, maxR + 20);
          const words = c.label.split(" ");
          return (
            <text
              key={c.key}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-zinc-500 dark:fill-zinc-400"
              fontSize={9}
              fontWeight={500}
            >
              {words.length > 1 ? (
                <>
                  <tspan x={x} dy="-0.4em">
                    {words[0]}
                  </tspan>
                  <tspan x={x} dy="1.15em">
                    {words.slice(1).join(" ")}
                  </tspan>
                </>
              ) : (
                c.label
              )}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
