"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";

/**
 * Admin Sidebar Footer
 *
 * Footer component for admin panel sidebar
 * Displays link back to dashboard
 */
export function AdminSidebarFooter() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild size="lg" tooltip="Back to Dashboard">
          <Link href="/dashboard/start">
            <LayoutDashboard className="size-4" />
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="font-medium">Back to Dashboard</span>
              <span className="text-xs text-muted-foreground">Return to main app</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
