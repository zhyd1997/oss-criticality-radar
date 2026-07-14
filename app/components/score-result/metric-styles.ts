import type { ComponentType, SVGProps } from "react";
import type { CriticalitySignals } from "@/lib/types";
import {
  AlertIcon,
  AtIcon,
  BuildingIcon,
  ChartIcon,
  ChatIcon,
  CheckIcon,
  ClockIcon,
  RocketIcon,
  UserIcon,
  UsersIcon,
} from "../icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export type MetricStyle = {
  iconBg: string;
  valueColor: string;
  Icon: IconComponent;
};

/** Complete style map for every OpenSSF signal — missing keys are a type error. */
export const METRIC_STYLES: Record<keyof CriticalitySignals, MetricStyle> = {
  created_since: {
    iconBg:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    valueColor: "text-emerald-600 dark:text-emerald-400",
    Icon: UsersIcon,
  },
  updated_since: {
    iconBg: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400",
    valueColor: "text-sky-600 dark:text-sky-400",
    Icon: ClockIcon,
  },
  contributor_count: {
    iconBg:
      "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
    valueColor: "text-violet-600 dark:text-violet-400",
    Icon: UserIcon,
  },
  org_count: {
    iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    valueColor: "text-amber-600 dark:text-amber-400",
    Icon: BuildingIcon,
  },
  commit_frequency: {
    iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    valueColor: "text-blue-600 dark:text-blue-400",
    Icon: ChartIcon,
  },
  recent_release_count: {
    iconBg: "bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
    valueColor: "text-cyan-600 dark:text-cyan-400",
    Icon: RocketIcon,
  },
  updated_issues_count: {
    iconBg:
      "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
    valueColor: "text-orange-600 dark:text-orange-400",
    Icon: AlertIcon,
  },
  closed_issues_count: {
    iconBg: "bg-lime-100 text-lime-600 dark:bg-lime-950 dark:text-lime-400",
    valueColor: "text-lime-600 dark:text-lime-400",
    Icon: CheckIcon,
  },
  issue_comment_frequency: {
    iconBg:
      "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    valueColor: "text-purple-600 dark:text-purple-400",
    Icon: ChatIcon,
  },
  github_mention_count: {
    iconBg:
      "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
    valueColor: "text-indigo-600 dark:text-indigo-400",
    Icon: AtIcon,
  },
};
