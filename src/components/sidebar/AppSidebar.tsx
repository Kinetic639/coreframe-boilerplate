import React from "react";
import { Sidebar, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import AppSidebarHeader from "./AppSidebarHeader";
import { cn } from "../lib/utils";

const AppSidebar = async () => {
  const appContext = await loadAppContextServer();
  const logo: string = appContext?.activeOrg?.logo_url;
  const themeColor = appContext?.activeOrg?.theme_color;

  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className={cn(
        "border-none bg-sidebar",
        themeColor ? "bg-[color:var(--theme-color)]" : "bg-sidebar"
      )}
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3.5rem",
        } as React.CSSProperties
      }
    >
      <AppSidebarHeader logo={logo} />
      <SidebarContent className="flex h-full flex-col justify-between">content</SidebarContent>

      {/* User Profile & Logout */}
      <SidebarFooter className="border-t border-white/10 px-3 py-2">footer</SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
