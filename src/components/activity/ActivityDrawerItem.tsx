"use client";

import { useFormatter } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ProjectedEvent } from "@/server/audit/types";
import { EventCategoryIcon, EventIntentIcon } from "@/components/audit/event-icons";
import { useActivitySummary } from "./useActivitySummary";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActivityDrawerItemProps {
  event: ProjectedEvent;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A single activity item in the Recent Activity Drawer.
 *
 * Renders:
 *  - Icon (from event.iconKey, falls back to Settings)
 *  - Summary text (resolved from summaryKey + summaryPerspective + summaryParams)
 *  - Relative timestamp
 *
 * Clicking navigates to event.primaryHref if available.
 */
export function ActivityDrawerItem({ event }: ActivityDrawerItemProps) {
  const summary = useActivitySummary(event);
  const format = useFormatter();

  const date = new Date(event.created_at);
  const relativeTime = format.relativeTime(date, new Date());

  const content = (
    <div
      className={cn(
        "group flex gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
        event.primaryHref && "cursor-pointer"
      )}
    >
      {/* Category icon — primary domain indicator */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted relative">
        <EventCategoryIcon category={event.category} className="text-muted-foreground" />
        {/* Intent icon overlay — bottom-right corner */}
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <EventIntentIcon intent={event.intent} className="h-2.5 w-2.5" />
        </span>
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm text-foreground leading-snug line-clamp-2">{summary}</p>
        <p className="text-xs text-muted-foreground">{relativeTime}</p>
      </div>
    </div>
  );

  if (event.primaryHref) {
    return (
      <Link
        href={event.primaryHref as Parameters<typeof Link>[0]["href"]}
        className="block no-underline"
      >
        {content}
      </Link>
    );
  }

  return content;
}
