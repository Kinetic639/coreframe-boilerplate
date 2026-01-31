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
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { LoadingSkeleton } from "@/components/v2/feedback/loading-skeleton";

/**
 * Header Notifications Component
 *
 * Notifications drawer that slides from the right
 *
 * Features:
 * - Bell icon with unread count badge
 * - Slide-out drawer from right side
 * - Example notifications with different types
 * - Mark individual notifications as read
 * - Clear all notifications
 *
 * TODO: Connect to real notifications system:
 * - Real-time updates via Supabase Realtime
 * - Persist read status to database
 * - Link to full notifications page
 */

type NotificationType = "info" | "success" | "warning";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

const EXAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "info",
    title: "System Update",
    message: "New features have been added to the dashboard. Check them out!",
    timestamp: "5 min ago",
    isRead: false,
  },
  {
    id: "2",
    type: "success",
    title: "Task Completed",
    message: "Your warehouse audit has been successfully completed.",
    timestamp: "1 hour ago",
    isRead: false,
  },
  {
    id: "3",
    type: "warning",
    title: "Low Stock Alert",
    message: "Product SKU-12345 is running low on stock in Location A.",
    timestamp: "2 hours ago",
    isRead: false,
  },
  {
    id: "4",
    type: "info",
    title: "Team Invitation",
    message: "You have been invited to join the Sales team.",
    timestamp: "1 day ago",
    isRead: true,
  },
  {
    id: "5",
    type: "success",
    title: "Report Generated",
    message: "Your monthly inventory report is ready for download.",
    timestamp: "2 days ago",
    isRead: true,
  },
];

const notificationIcons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
};

const notificationColors = {
  info: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
  success: "text-green-600 bg-green-50 dark:bg-green-950/30",
  warning: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
};

export function HeaderNotifications() {
  const [notifications, setNotifications] = useState(EXAMPLE_NOTIFICATIONS);
  const isLoading = false;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const clearAll = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 relative"
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
              : "You're all caught up!"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-1">
          {isLoading ? (
            <LoadingSkeleton variant="list" count={5} />
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="no-scrollbar overflow-y-auto max-h-[calc(100vh-200px)]">
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type];
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "group relative flex gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
                      !notification.isRead && "bg-muted/30"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        notificationColors[notification.type]
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-none">{notification.title}</p>
                        <button
                          onClick={() => removeNotification(notification.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          aria-label="Remove notification"
                        >
                          <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">{notification.timestamp}</p>
                        {!notification.isRead && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-primary hover:underline"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <SheetFooter className="mt-6">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearAll} className="w-full">
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
