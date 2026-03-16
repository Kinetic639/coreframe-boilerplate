"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Activity, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { getRecentActivityAction } from "@/app/actions/audit/get-recent-activity";
import { ActivityDrawerItem } from "./ActivityDrawerItem";
import { LoadingSkeleton } from "@/components/v2/feedback/loading-skeleton";
import type { ProjectedEvent } from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActivityDrawerProps {
  /** SSR-loaded initial events — avoids a loading flash on open */
  initialEvents: ProjectedEvent[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Recent Activity Drawer
 *
 * Slide-out drawer showing the last 10 personal activity events.
 * Loads initial data from SSR props and can optionally refresh on open.
 *
 * Uses shadcn/ui Sheet for the drawer panel.
 * Each item renders the rich i18n summary with optional entity links.
 */
export function ActivityDrawer({ initialEvents }: ActivityDrawerProps) {
  const t = useTranslations("activityDrawer");
  const [events, setEvents] = useState<ProjectedEvent[]>(initialEvents);
  const [isRefreshing, startTransition] = useTransition();

  function handleOpen(open: boolean) {
    if (!open) return;
    // Refresh data on each open to show latest activity
    startTransition(async () => {
      const result = await getRecentActivityAction();
      if (result.success) {
        setEvents(result.data.events);
      }
    });
  }

  return (
    <Sheet onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative" aria-label={t("title")}>
          <Activity className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-6">
          {isRefreshing ? (
            <LoadingSkeleton variant="list" count={5} />
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Activity className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">{t("empty")}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {events.map((event) => (
                <ActivityDrawerItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>

        <SheetFooter className="mt-4 border-t pt-4">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/dashboard/activity">
              {t("viewAll")}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
