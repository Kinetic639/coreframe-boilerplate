"use client";
import React from "react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";

const AppSidebar = () => {
  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="border-none bg-[color:var(--theme-color,_theme(colors.sidebar))]"
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3.5rem",
        } as React.CSSProperties
      }
    >
      <SidebarHeader className="bg-[color:var(--theme-color,_theme(colors.sidebar))] pb-2 pt-4">
        header
      </SidebarHeader>

      <SidebarContent className="flex h-full flex-col justify-between">content</SidebarContent>

      {/* User Profile & Logout */}
      <SidebarFooter className="border-t border-white/10 px-3 py-2">footer</SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
