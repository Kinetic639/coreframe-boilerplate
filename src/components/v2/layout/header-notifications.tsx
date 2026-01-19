"use client";

import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

/**
 * Header Notifications Component (PLACEHOLDER)
 *
 * Placeholder for future notifications feature
 *
 * TODO: Implement full notifications system:
 * - Bell icon with unread count badge
 * - Notification popover/dropdown
 * - Real-time updates via Supabase Realtime
 * - Mark as read functionality
 * - Link to full notifications page
 *
 * For now: Just renders a disabled bell icon button
 */
export function HeaderNotifications() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 relative"
      aria-label="Notifications (coming soon)"
      disabled
      title="Notifications feature coming soon"
    >
      <Bell className="h-5 w-5" />
      {/* Future: Badge for unread count */}
      {/* <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" /> */}
    </Button>
  );
}
