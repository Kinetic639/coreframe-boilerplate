/**
 * Single source of truth for stock-audit status colors. Per the
 * implementation plan §6/§13: structural colors are Ambra design tokens;
 * semantic status colors (shortage/match/surplus/recount/skipped) stay
 * literal Tailwind palette classes since no --success/--warning/--info
 * token exists anywhere in this codebase — matching how existing
 * movement-status badges already handle status semantics. Defined once
 * here, imported everywhere (position tracker, variance groups, item
 * cards, dashboard badges) instead of re-declared per component.
 */
import type { CountLineStatus, CountSessionStatus } from "./count-session-types";

export interface StatusColorClasses {
  text: string;
  bg: string;
  border: string;
}

/** Session-level status badge colors (dashboard list, headers). Each
 * semantic color pairs a light-mode shade with a `dark:` override — the
 * original dark-only `-950/40`-style backgrounds read as near-black mud on
 * a light background, so they're not just reused across themes. */
export const COUNT_SESSION_STATUS_COLOR_CLASSES: Record<CountSessionStatus, StatusColorClasses> = {
  draft: { text: "text-muted-foreground", bg: "bg-muted", border: "border-border" },
  counting: { text: "text-primary", bg: "bg-primary/10", border: "border-primary/30" },
  submitted: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-950/30",
    border: "border-amber-400/60 dark:border-amber-900/40",
  },
  approved: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-950/30",
    border: "border-emerald-400/60 dark:border-emerald-900/40",
  },
  cancelled: {
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-950/30",
    border: "border-red-400/60 dark:border-red-900/40",
  },
};

/**
 * Richer per-line "position" status — matches the prototype's
 * PositionStatusTracker.tsx derivation exactly: not just the raw line
 * status, but status *combined with* variance sign, so a shortage and a
 * surplus render differently even though both are technically
 * status="counted"/"approved".
 */
export type CountLinePositionStatus =
  | "not_started"
  | "counted_ok"
  | "surplus"
  | "shortage"
  | "skipped"
  | "needs_recount";

export function getCountLinePositionStatus(
  line: { status: CountLineStatus; variance_quantity: number | null },
  showExpectedQuantity: boolean
): CountLinePositionStatus {
  if (line.status === "skipped") return "skipped";
  if (line.status === "needs_recount") return "needs_recount";
  if (line.status === "counted" || line.status === "approved") {
    if (!showExpectedQuantity) return "counted_ok";
    const variance = line.variance_quantity ?? 0;
    if (variance === 0) return "counted_ok";
    return variance > 0 ? "surplus" : "shortage";
  }
  return "not_started";
}

export const COUNT_LINE_POSITION_STATUS_COLOR_CLASSES: Record<
  CountLinePositionStatus,
  StatusColorClasses & { symbol: string }
> = {
  not_started: {
    text: "text-muted-foreground",
    bg: "bg-muted/60",
    border: "border-border",
    symbol: "○",
  },
  counted_ok: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-950/40",
    border: "border-emerald-400/60 dark:border-emerald-600/50",
    symbol: "✓",
  },
  surplus: {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-950/40",
    border: "border-blue-400/60 dark:border-blue-500/50",
    symbol: "+",
  },
  shortage: {
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-950/40",
    border: "border-red-400/60 dark:border-red-600/50",
    symbol: "−",
  },
  skipped: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-950/40",
    border: "border-amber-400/60 dark:border-amber-500/50",
    symbol: "↷",
  },
  needs_recount: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-950/40",
    border: "border-amber-400/60 dark:border-amber-500/50",
    symbol: "↷",
  },
};
