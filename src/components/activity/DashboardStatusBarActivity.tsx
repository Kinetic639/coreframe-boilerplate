"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { History } from "lucide-react";
import { getRecentActivityAction } from "@/app/actions/audit/get-recent-activity";
import { ActivityDrawer } from "./ActivityDrawer";
import { EventCategoryIcon } from "@/components/audit/event-icons";
import { useActivitySummary } from "./useActivitySummary";
import type { ProjectedEvent } from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Light polling interval — catches events created outside this tab/session */
const POLL_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// LatestEventSummary — wrapper to avoid conditional hook call
// ---------------------------------------------------------------------------

/**
 * Small wrapper component so useActivitySummary is always called at the
 * component level (React rules of hooks), never conditionally.
 */
function LatestEventSummary({ event }: { event: ProjectedEvent }) {
  const summary = useActivitySummary(event);
  return <span className="truncate max-w-xs">{summary}</span>;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DashboardStatusBarActivityProps {
  /** SSR-provided initial events — avoids blank state on first render */
  initialEvents: ProjectedEvent[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DashboardStatusBarActivity — layout-local controller for recent activity.
 *
 * Single owner of:
 *   - `open`          drawer open/close state
 *   - `events`        recent projected events (single source of truth)
 *   - `isRefreshing`  in-flight refresh indicator
 *
 * Derived value:
 *   - `latestEvent = events[0]` — shown in the status bar; never duplicated
 *
 * Refresh triggers (all use the same `refreshRecentActivity` function):
 *   1. Drawer open      — always show fresh events when user opens the drawer
 *   2. Window focus     — catches events created in another tab
 *   3. Visibility change — catches events from background navigation
 *   4. Polling fallback — 30-second interval, lightweight
 *
 * Race safety: a monotonic sequence counter on the ref ensures that stale
 * slow responses arriving after a newer request are silently discarded.
 *
 * No Zustand. No global store. This is layout-local UI + server-derived data.
 */
export function DashboardStatusBarActivity({ initialEvents }: DashboardStatusBarActivityProps) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ProjectedEvent[]>(initialEvents);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Monotonic counter for race safety. Each call to refreshRecentActivity
   * increments this before the async fetch. On resolution we check that the
   * local `seq` still matches the ref — if not, a newer request has since
   * started and this response is stale, so we discard it.
   */
  const refreshSeqRef = useRef(0);

  const refreshRecentActivity = useCallback(async () => {
    const seq = ++refreshSeqRef.current;
    setIsRefreshing(true);

    const result = await getRecentActivityAction();

    // Discard stale response if a newer request has since been issued
    if (seq !== refreshSeqRef.current) return;

    setIsRefreshing(false);
    if (result.success) {
      setEvents(result.data.events);
    }
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    // Refresh on open so the drawer always shows the latest events
    if (nextOpen) {
      refreshRecentActivity();
    }
  }

  // Register window focus, visibility change, and polling refresh triggers
  useEffect(() => {
    const handleFocus = () => refreshRecentActivity();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshRecentActivity();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = setInterval(refreshRecentActivity, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [refreshRecentActivity]);

  // Single derived value — never duplicated in separate state
  const latestEvent = events[0] ?? null;

  return (
    <>
      {/* Status bar trigger button */}
      <button
        onClick={() => handleOpenChange(true)}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors max-w-sm"
        aria-label="Recent Activity"
      >
        {latestEvent ? (
          <>
            <EventCategoryIcon category={latestEvent.category} className="h-3 w-3 shrink-0" />
            <LatestEventSummary event={latestEvent} />
          </>
        ) : (
          <>
            <History className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">No recent activity</span>
          </>
        )}
      </button>

      {/* Controlled drawer — mounted here, triggered from the button above */}
      <ActivityDrawer
        open={open}
        onOpenChange={handleOpenChange}
        events={events}
        isRefreshing={isRefreshing}
      />
    </>
  );
}
