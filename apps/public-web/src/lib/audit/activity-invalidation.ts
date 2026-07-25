/**
 * Same-tab activity invalidation signal.
 *
 * After any action that successfully produces a platform_events row, call
 * notifyActivityProduced(). The status bar preview listens for this signal
 * and immediately refreshes so the new event appears without waiting for the
 * next focus/visibility/polling trigger.
 *
 * Uses a lightweight browser CustomEvent — no global store, no Zustand.
 * Server-side safe: the dispatch call is a no-op when `window` is unavailable.
 *
 * Usage:
 *   import { notifyActivityProduced } from "@/lib/audit/activity-invalidation";
 *
 *   // After a successful server action that emits a platform event:
 *   notifyActivityProduced();
 */

export const ACTIVITY_PRODUCED_EVENT = "coreframe:activity-produced" as const;

/**
 * Signals that a new activity event was produced in the current tab.
 * The status bar preview component listens for this and refreshes immediately.
 */
export function notifyActivityProduced(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ACTIVITY_PRODUCED_EVENT));
}
