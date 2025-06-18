import React from "react";
import { Sidebar, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import AppSidebarHeader from "./AppSidebarHeader";
import { cn } from "../../lib/utils";
import ModuleSection from "./ModuleSection";
import { modules } from "@/modules";
import { ScrollArea } from "../../ui/scroll-area";

const AppSidebar = async () => {
  const appContext = await loadAppContextServer();
  const logo: string = appContext?.activeOrg?.logo_url;
  const name: string = appContext?.activeOrg?.name;

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
      <AppSidebarHeader logo={logo} name={name} />
      <SidebarContent className="flex h-full flex-col justify-between">
        <ScrollArea className="min-h-full">
          <div className="flex flex-col gap-8 px-3 py-4">
            {modules.map((module) => (
              <ModuleSection key={module.id} module={module} />
            ))}
          </div>
        </ScrollArea>
      </SidebarContent>

      {/* User Profile & Logout */}
      <SidebarFooter className="border-t border-white/10 px-3 py-2">footer</SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
