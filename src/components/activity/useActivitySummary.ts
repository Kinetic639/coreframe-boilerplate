"use client";

import { useTranslations } from "next-intl";
import type { ProjectedEvent } from "@/server/audit/types";

/**
 * useActivitySummary
 *
 * Resolves the translated summary string for a projected event using the
 * rich summary model fields (summaryKey, summaryPerspective, summaryParams).
 *
 * Resolution order:
 *  1. Use summaryKey + summaryPerspective to look up the translation
 *     e.g. key = "events.auth.login", perspective = "self"
 *     → resolved key = "events.auth.login.self"
 *  2. If the key doesn't exist, fall back to the legacy `summary` field
 *
 * next-intl interpolation:
 *   Translation strings may use named params like {actorName}, {targetName}, etc.
 *   These are passed directly from summaryParams.
 *
 * Note: next-intl requires all message keys to be resolved at the call site.
 * We cannot dynamically construct the full path at runtime; instead we use
 * `t.has()` to guard before calling `t()` with the dynamic path.
 */
export function useActivitySummary(event: ProjectedEvent): string {
  // Use a broad namespace that covers all event keys
  const t = useTranslations();

  const { summaryKey, summaryPerspective, summaryParams, summary } = event;

  // Build the full translation key: "events.auth.login.self"
  const fullKey = `${summaryKey}.${summaryPerspective}`;

  // Check if the translation key exists; fall back to legacy summary if not
  if (t.has(fullKey)) {
    try {
      // next-intl t() accepts a path and params object
      // The params object uses the values from summaryParams
      return t(fullKey, summaryParams as Parameters<typeof t>[1]);
    } catch {
      // Translation error — fall back to legacy summary
      return summary;
    }
  }

  // Fall back to legacy summary string (always present for backward compat)
  return summary;
}
