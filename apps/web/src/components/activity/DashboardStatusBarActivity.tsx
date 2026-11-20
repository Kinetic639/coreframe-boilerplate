"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { History } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useFormatter } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getLatestActivityAction } from "@/app/actions/audit/get-latest-activity";
import { hasNewActivityAction } from "@/app/actions/audit/has-new-activity";
import { ACTIVITY_PRODUCED_EVENT } from "@/lib/audit/activity-invalidation";
import { EventCategoryIcon, EventIntentIcon } from "@/components/audit/event-icons";
import { useActivitySummary } from "./useActivitySummary";
import type { ProjectedEvent } from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Polling interval for events from other sessions and tabs. Runs every two
 * minutes and only while the tab is visible; coming back to the tab checks at
 * once (focus / visibilitychange). A tick and a focus first ask
 * hasNewActivityAction (one small query) and load the latest event (context,
 * events and names, about four requests) only when something new exists. The
 * same tab signals its own changes through ACTIVITY_PRODUCED_EVENT, which
 * refreshes at once.
 */
const POLL_INTERVAL_MS = 120_000;

// ---------------------------------------------------------------------------
// LatestEventContent
// ---------------------------------------------------------------------------

/**
 * Renders the compact preview row for a known latest event.
 * Isolated so both useActivitySummary and useFormatter are always called
 * at component level — never conditionally.
 */
function LatestEventContent({ event }: { event: ProjectedEvent }) {
  const summary = useActivitySummary(event);
  const format = useFormatter();
  const relativeTime = format.relativeTime(new Date(event.created_at), new Date());

  return (
    <>
      {/* Primary domain icon */}
      <EventCategoryIcon
        category={event.category}
        className="h-3 w-3 shrink-0 text-muted-foreground"
      />
      {/* Secondary intent icon — colored by intent */}
      <EventIntentIcon intent={event.intent} className="h-2.5 w-2.5 shrink-0" colored />
      {/* Truncated summary — clipped to available status-bar width */}
      <span className="truncate min-w-0">{summary}</span>
      {/* Compact relative timestamp — hidden on narrow viewports */}
      <span className="shrink-0 text-muted-foreground/60 tabular-nums hidden sm:inline">
        {relativeTime}
      </span>
    </>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DashboardStatusBarActivityProps {
  /** SSR-provided initial latest event — avoids blank state on first render */
  initialLatestEvent: ProjectedEvent | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DashboardStatusBarActivity — compact activity preview in the status bar.
 *
 * Renders a single clickable row showing the latest real activity event.
 * Clicking navigates to the full personal activity page.
 * No drawer. No popover. Navigation only.
 *
 * Owns:
 *   - `latestEvent`   the single most recent projected event (null = none)
 *   - `isRefreshing`  in-flight indicator
 *
 * Refresh triggers:
 *   1. Window focus     — checks for events from another tab/session
 *   2. Visibility change — checks for events from background navigation
 *   3. Polling (120s)   — the same check while the tab is visible
 *   (1–3 load the event only when hasNewActivityAction finds a newer one)
 *   4. Same-tab signal  — listens for `coreframe:activity-produced` CustomEvent
 *                         so callers that just performed an action can push
 *                         an immediate refresh without any global store
 *
 * Race safety: monotonic sequence ref discards stale responses.
 *
 * Animation: framer-motion AnimatePresence fades/slides content when the
 * latest event changes (keyed by event.id). Stays compact and subtle.
 *
 * No Zustand. No global store. No drawer.
 */
export function DashboardStatusBarActivity({
  initialLatestEvent,
}: DashboardStatusBarActivityProps) {
  const [latestEvent, setLatestEvent] = useState<ProjectedEvent | null>(initialLatestEvent);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Monotonic counter for race safety
  const refreshSeqRef = useRef(0);

  // Events newer than this are "new". Starts at the event the server rendered
  // (or the beginning of time when there was none); after a refresh that a
  // check triggered, it moves to the server time of that check.
  const sinceRef = useRef<string>(initialLatestEvent?.created_at ?? new Date(0).toISOString());

  const refreshLatestActivity = useCallback(async () => {
    const seq = ++refreshSeqRef.current;
    setIsRefreshing(true);

    const result = await getLatestActivityAction();

    // Discard stale response if a newer request started after this one
    if (seq !== refreshSeqRef.current) return;

    setIsRefreshing(false);
    if (result.success) {
      setLatestEvent(result.data.event);
    }
  }, []);

  // Poll and focus: one small query, the full refresh only when it finds something
  const checkForNewActivity = useCallback(async () => {
    const result = await hasNewActivityAction(sinceRef.current);
    if (!result.success) return;
    if (!result.data.hasNew) return;
    sinceRef.current = result.data.checkedAt;
    await refreshLatestActivity();
  }, [refreshLatestActivity]);

  useEffect(() => {
    const handleFocus = () => checkForNewActivity();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkForNewActivity();
    };
    const handleInvalidate = () => refreshLatestActivity();

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener(ACTIVITY_PRODUCED_EVENT, handleInvalidate);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") checkForNewActivity();
    }, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener(ACTIVITY_PRODUCED_EVENT, handleInvalidate);
      clearInterval(interval);
    };
  }, [refreshLatestActivity, checkForNewActivity]);

  // The animated content key: stable per-event so AnimatePresence knows when
  // to transition, but "no-activity" is stable for the empty fallback.
  const contentKey = latestEvent?.id ?? "no-activity";

  return (
    <Link
      href="/dashboard/activity"
      aria-label="Recent Activity — view full history"
      className={`
        flex items-center gap-1.5 max-w-xs text-muted-foreground
        hover:text-foreground transition-colors overflow-hidden
        focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm
        ${isRefreshing ? "opacity-60" : "opacity-100"}
      `}
    >
      <AnimatePresence mode="wait" initial={false}>
        {latestEvent ? (
          <motion.span
            key={contentKey}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex items-center gap-1.5 min-w-0"
          >
            <LatestEventContent event={latestEvent} />
          </motion.span>
        ) : (
          <motion.span
            key="no-activity"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1.5 text-muted-foreground/60"
          >
            <History className="h-3 w-3 shrink-0" />
            <span className="hidden sm:inline">No recent activity</span>
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
