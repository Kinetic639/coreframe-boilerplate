import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { RequestState } from "@/server/requests/types";

/** Badge colors per state, for the light and the dark theme. */
const STATE_CLASS: Record<RequestState, { badge: string; dot: string }> = {
  yourTurn: {
    badge:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  vendor: {
    badge:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/30 dark:bg-slate-400/15 dark:text-slate-300",
    dot: "bg-slate-500 dark:bg-slate-400",
  },
  approval: {
    badge:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  progress: {
    badge:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  new: {
    badge:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  answered: {
    badge:
      "border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-300",
    dot: "bg-green-500",
  },
  closed: { badge: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  cancelled: {
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
};

export function StatusBadge({ state, className }: { state: RequestState; className?: string }) {
  const t = useTranslations("requests.state");
  const s = STATE_CLASS[state];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium",
        s.badge,
        className
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {t(state)}
    </span>
  );
}

/** Small dot marking a request that waits for the user's answer. */
export function AttentionDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500", className)}
    />
  );
}
