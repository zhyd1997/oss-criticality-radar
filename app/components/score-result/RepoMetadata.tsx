import type { ComponentType, SVGProps } from "react";
import type { RepoMeta } from "@/lib/types";
import {
  CalendarIcon,
  ClockIcon,
  CodeIcon,
  LicenseIcon,
  StarIcon,
} from "../icons";
import { formatUtc } from "./format";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

const TONES = {
  sky: {
    bg: "bg-sky-50 dark:bg-sky-950/40",
    icon: "bg-sky-100 text-sky-600 dark:bg-sky-900/60 dark:text-sky-400",
    border: "border-sky-100 dark:border-sky-900/40",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-400",
    border: "border-emerald-100 dark:border-emerald-900/40",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-400",
    border: "border-amber-100 dark:border-amber-900/40",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    icon: "bg-violet-100 text-violet-600 dark:bg-violet-900/60 dark:text-violet-400",
    border: "border-violet-100 dark:border-violet-900/40",
  },
} as const;

type Tone = keyof typeof TONES;

type MetaItem = {
  label: string;
  value: string;
  tone: Tone;
  Icon: IconComponent;
  className?: string;
};

export function RepoMetadata({ repo }: { repo: RepoMeta }) {
  const items: MetaItem[] = [
    {
      label: "Language",
      value: repo.language ?? "—",
      tone: "sky",
      Icon: CodeIcon,
    },
    {
      label: "License",
      value: repo.license ?? "—",
      tone: "emerald",
      Icon: LicenseIcon,
    },
    {
      label: "Stars",
      value: repo.stars.toLocaleString(),
      tone: "amber",
      Icon: StarIcon,
    },
    {
      label: "Created at",
      value: formatUtc(repo.createdAt),
      tone: "violet",
      Icon: CalendarIcon,
    },
    {
      label: "Updated at",
      value: formatUtc(repo.updatedAt),
      tone: "sky",
      Icon: ClockIcon,
      className: "sm:col-span-2",
    },
  ];

  return (
    <div>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Repository metadata
      </h3>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items.map((item) => (
          <MetaCard key={item.label} {...item} />
        ))}
      </div>
    </div>
  );
}

function MetaCard({
  label,
  value,
  tone,
  Icon,
  className = "",
}: MetaItem) {
  const t = TONES[tone];
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${t.bg} ${t.border} ${className}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.icon}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        <p className="break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {value}
        </p>
      </div>
    </div>
  );
}
