"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ProjectedEvent } from "@/server/audit/types";
import type { ProjectionScope } from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EventFeedClientProps {
  events: ProjectedEvent[];
  total: number;
  limit: number;
  offset: number;
  scope: ProjectionScope;
  /** Called when user requests a different page. */
  onPageChange: (newOffset: number) => void;
}

// ---------------------------------------------------------------------------
// Tier badge variant mapping
// ---------------------------------------------------------------------------

const TIER_VARIANT = {
  baseline: "secondary",
  enhanced: "default",
  forensic: "destructive",
} as const satisfies Record<string, "secondary" | "default" | "destructive">;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EventFeedClient({
  events,
  total,
  limit,
  offset,
  scope,
  onPageChange,
}: EventFeedClientProps) {
  const t = useTranslations("activityFeed");

  const currentPage = Math.floor(offset / limit);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  if (events.length === 0 && offset === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">{t("empty")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Event list */}
      <div className="flex flex-col divide-y divide-border rounded-md border bg-card">
        {events.map((event) => (
          <EventRow key={event.id} event={event} scope={scope} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t("pagination", {
              from: offset + 1,
              to: Math.min(offset + limit, total),
              total,
            })}
          </span>
          <div className="flex gap-2">
            <button
              className="rounded border px-3 py-1 disabled:opacity-40 hover:bg-accent"
              disabled={!hasPrev}
              onClick={() => onPageChange(Math.max(0, offset - limit))}
            >
              {t("prev")}
            </button>
            <span className="px-2 py-1">
              {t("pageOf", { page: currentPage + 1, total: totalPages })}
            </span>
            <button
              className="rounded border px-3 py-1 disabled:opacity-40 hover:bg-accent"
              disabled={!hasNext}
              onClick={() => onPageChange(offset + limit)}
            >
              {t("next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single event row
// ---------------------------------------------------------------------------

function EventRow({ event, scope }: { event: ProjectedEvent; scope: ProjectionScope }) {
  const t = useTranslations("activityFeed");

  const date = new Date(event.created_at);
  const dateStr = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={TIER_VARIANT[event.event_tier]}>{event.event_tier}</Badge>
          <span className="text-xs font-mono text-muted-foreground">{event.action_key}</span>
        </div>
        <p className="text-sm text-foreground">{event.summary}</p>
        {scope === "audit" && event.ip_address && (
          <p className="text-xs text-muted-foreground font-mono">
            {t("ip")}: {event.ip_address}
          </p>
        )}
        {scope === "audit" && event.user_agent && (
          <p className="text-xs text-muted-foreground truncate max-w-md">
            {t("ua")}: {event.user_agent}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end shrink-0 text-xs text-muted-foreground">
        <span>{dateStr}</span>
        <span>{timeStr}</span>
      </div>
    </div>
  );
}
