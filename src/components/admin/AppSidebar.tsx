"use client";
import Link from "next/link";
import { LayoutDashboard, Users, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const sidebarItems = [
  { path: "/protected/admin-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/protected/admin-dashboard/users", label: "Users", icon: Users },
  { path: "/protected/admin-dashboard/settings", label: "Settings", icon: Settings },
];

export default function AppSidebar() {
  const { state } = useSidebar();
  let pathname = "";
  if (typeof window !== "undefined") pathname = window.location.pathname;
  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  return (
    <Sidebar variant="sidebar" className="border-none" collapsible="icon">
      <SidebarHeader className="pb-2 pt-4">
        <div
          className={cn("ml-0 flex items-center px-2", state === "collapsed" && "justify-center")}
        >
          <Link
            href="/protected/admin-dashboard"
            className={cn(
              "flex items-center",
              state === "expanded" ? "gap-3" : "w-full justify-center"
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-lg font-bold text-white">
              A
            </div>
            {state === "expanded" && <div className="text-xl font-bold text-white">Admin</div>}
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2">
          <SidebarMenu>
            {sidebarItems.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.path)}
                  tooltip={item.label}
                  className={cn(
                    "text-base text-sidebar-foreground hover:bg-white/10",
                    "group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:p-0",
                    isActive(item.path) && "bg-white/10 font-medium",
                    "flex items-center justify-start",
                    state === "collapsed" ? "justify-center" : "justify-start"
                  )}
                >
                  <Link
                    href={item.path}
                    className={cn(
                      "flex w-full items-center",
                      state === "expanded" ? "justify-start" : "justify-center"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {state !== "collapsed" && <span className="ml-3 text-base">{item.label}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
