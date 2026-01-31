"use client";

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
import { History, Eye, Edit, Trash2, Plus, Settings, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { LoadingSkeleton } from "@/components/v2/feedback/loading-skeleton";

/**
 * Status Bar History Component
 *
 * Compact history/activity drawer for status bar
 *
 * Features:
 * - Small History icon button in status bar
 * - Slide-out drawer from right side
 * - Recent activity log with timestamps
 * - Activity filtering by type
 * - Clear history option
 *
 * TODO: Connect to real activity tracking:
 * - Track user actions via middleware
 * - Persist to database
 * - Real-time updates via Supabase Realtime
 * - Link to full activity log page
 */

type ActivityType = "view" | "create" | "edit" | "delete" | "system";

interface Activity {
  id: string;
  type: ActivityType;
  action: string;
  entity: string;
  timestamp: string;
  user?: string;
}

const EXAMPLE_ACTIVITIES: Activity[] = [
  {
    id: "1",
    type: "view",
    action: "Viewed",
    entity: "Products List",
    timestamp: "Just now",
  },
  {
    id: "2",
    type: "edit",
    action: "Updated",
    entity: "Product SKU-12345",
    timestamp: "2 min ago",
  },
  {
    id: "3",
    type: "create",
    action: "Created",
    entity: "New Purchase Order #789",
    timestamp: "15 min ago",
  },
  {
    id: "4",
    type: "view",
    action: "Viewed",
    entity: "Warehouse Audit Report",
    timestamp: "1 hour ago",
  },
  {
    id: "5",
    type: "edit",
    action: "Updated",
    entity: "Stock Location A-12",
    timestamp: "2 hours ago",
  },
  {
    id: "6",
    type: "delete",
    action: "Deleted",
    entity: "Draft Inventory Count",
    timestamp: "3 hours ago",
  },
  {
    id: "7",
    type: "create",
    action: "Added",
    entity: "New Team Member",
    timestamp: "Yesterday",
  },
  {
    id: "8",
    type: "system",
    action: "System",
    entity: "Automated backup completed",
    timestamp: "Yesterday",
  },
];

const activityIcons = {
  view: Eye,
  create: Plus,
  edit: Edit,
  delete: Trash2,
  system: Settings,
};

const activityColors = {
  view: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
  create: "text-green-600 bg-green-50 dark:bg-green-950/30",
  edit: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
  delete: "text-red-600 bg-red-50 dark:bg-red-950/30",
  system: "text-gray-600 bg-gray-50 dark:bg-gray-950/30",
};

export function StatusBarHistory() {
  const [activities, setActivities] = useState(EXAMPLE_ACTIVITIES);
  const [filter, setFilter] = useState<ActivityType | "all">("all");
  const isLoading = false;

  const filteredActivities =
    filter === "all" ? activities : activities.filter((a) => a.type === filter);

  const clearHistory = () => {
    setActivities([]);
  };

  const removeActivity = (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Recent Activity"
        >
          <History className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">History</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Recent Activity</SheetTitle>
          <SheetDescription>Your recent actions and system events</SheetDescription>
        </SheetHeader>

        {/* Filter Tabs */}
        <div className="mt-4 flex gap-1 border-b pb-2 overflow-x-auto">
          {["all", "view", "create", "edit", "delete", "system"].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type as ActivityType | "all")}
              className={cn(
                "px-3 py-1 text-xs rounded-md transition-colors whitespace-nowrap",
                filter === type
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-1">
          {isLoading ? (
            <LoadingSkeleton variant="list" count={5} />
          ) : filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <History className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">No activity yet</p>
            </div>
          ) : (
            <div className="no-scrollbar overflow-y-auto max-h-[calc(100vh-280px)] space-y-2">
              {filteredActivities.map((activity) => {
                const Icon = activityIcons[activity.type];
                return (
                  <div
                    key={activity.id}
                    className="group relative flex gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        activityColors[activity.type]
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm leading-none">
                          <span className="font-medium">{activity.action}</span>{" "}
                          <span className="text-muted-foreground">{activity.entity}</span>
                        </p>
                        <button
                          onClick={() => removeActivity(activity.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          aria-label="Remove activity"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <SheetFooter className="mt-6">
          {activities.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearHistory} className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear History
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
