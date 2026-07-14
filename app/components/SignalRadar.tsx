"use client";

import type { SignalContribution } from "@/lib/types";

type Props = {
  contributions: SignalContribution[];
  score: number;
};

/**
 * SVG radar chart of normalized signal contributions (0–1).
 */
export function SignalRadar({ contributions, score }: Props) {
  const n = contributions.length;
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 36;

  const angleAt = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  const point = (i: number, r: number) => {
    const a = angleAt(i);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const dataPoints = contributions.map((c, i) => point(i, c.normalized * maxR));
  const polygon = dataPoints.map(([x, y]) => `${x},${y}`).join(" ");

  const scoreColor =
    score >= 0.7 ? "#22c55e" : score >= 0.4 ? "#eab308" : "#f97316";

  return (
    <div className="relative flex items-center justify-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-full w-full max-w-[320px]"
        role="img"
        aria-label={`Radar chart of criticality signals, score ${score.toFixed(3)}`}
      >
        <defs>
          <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={scoreColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={scoreColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={cx} cy={cy} r={maxR} fill="url(#radarGlow)" />

        {rings.map((ring) => (
          <polygon
            key={ring}
            points={Array.from({ length: n }, (_, i) => {
              const [x, y] = point(i, ring * maxR);
              return `${x},${y}`;
            }).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.12}
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
              strokeOpacity={0.1}
              strokeWidth={1}
            />
          );
        })}

        <polygon
          points={polygon}
          fill={scoreColor}
          fillOpacity={0.25}
          stroke={scoreColor}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {dataPoints.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={3.5}
            fill={scoreColor}
            stroke="var(--background)"
            strokeWidth={1.5}
          />
        ))}

        {contributions.map((c, i) => {
          const [x, y] = point(i, maxR + 18);
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
            >
              {words.length > 1 ? (
                <>
                  <tspan x={x} dy="-0.4em">
                    {words[0]}
                  </tspan>
                  <tspan x={x} dy="1.1em">
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
