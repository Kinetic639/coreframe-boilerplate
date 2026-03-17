"use client";

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
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { ActivityDrawerItem } from "./ActivityDrawerItem";
import { LoadingSkeleton } from "@/components/v2/feedback/loading-skeleton";
import type { ProjectedEvent } from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActivityDrawerProps {
  /** Controlled open state — owner decides when to open/close */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recent projected events — provided by the owning controller */
  events: ProjectedEvent[];
  /** True while a refresh is in-flight */
  isRefreshing: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Recent Activity Drawer — controlled, no own trigger.
 *
 * All state (open, events, refresh) lives in the owning controller
 * (DashboardStatusBarActivity). The drawer is purely presentational
 * and accepts props for everything it displays.
 *
 * Loading strategy: shows existing events immediately during refresh
 * (no skeleton flash if events are already loaded). Skeleton is shown
 * only on first open when events is still empty.
 */
export function ActivityDrawer({ open, onOpenChange, events, isRefreshing }: ActivityDrawerProps) {
  const t = useTranslations("activityDrawer");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-6">
          {isRefreshing && events.length === 0 ? (
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
