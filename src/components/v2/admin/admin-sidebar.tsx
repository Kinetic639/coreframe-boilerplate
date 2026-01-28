"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  TestTube,
  Settings,
  FileText,
  BarChart3,
  Shield,
  Palette,
} from "lucide-react";

const navigationItems = [
  {
    title: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Primitives",
    href: "/admin/primitives",
    icon: Palette,
  },
  {
    title: "Testing Tools",
    href: "/admin/testing",
    icon: TestTube,
  },
  {
    title: "App Management",
    href: "/admin/app-management",
    icon: Settings,
  },
  {
    title: "System Logs",
    href: "/admin/logs",
    icon: FileText,
  },
  {
    title: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
  },
];

/**
 * Admin Sidebar V2
 *
 * Navigation sidebar for Admin Panel
 *
 * Features:
 * - Admin panel navigation
 * - Active state detection via pathname
 * - Automatic mobile drawer behavior (inherited from shadcn/ui Sidebar)
 * - Back to dashboard link in footer
 *
 * Uses shadcn/ui Sidebar component for consistent behavior with dashboard
 */
export function AdminSidebarV2() {
  const pathname = usePathname();

  return (
    <Sidebar className="admin-sidebar">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-red-600" />
          <span className="text-lg font-bold">Admin Panel</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className={
                    isActive
                      ? "bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900"
                      : ""
                  }
                >
                  <Link href={item.href}>
                    <Icon className="h-5 w-5" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <Link
          href="/dashboard/start"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LayoutDashboard className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
