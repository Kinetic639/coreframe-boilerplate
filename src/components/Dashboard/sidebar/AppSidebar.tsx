import React from "react";
import { Sidebar, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import AppSidebarHeader from "./AppSidebarHeader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { appVersion } from "@/lib/version";
import ModuleSectionWrapper from "./ModuleSectionWrapper";
import { createClient } from "@/utils/supabase/server";
import { getAllModules } from "@/modules"; // 🔄 zamiana statycznego importu na dynamiczny

const AppSidebar = async () => {
  const appContext = await loadAppContextServer();
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token ?? "";

  const logo = appContext?.activeOrg?.logo_url;
  const name = appContext?.activeOrg?.name;
  const name2 = appContext?.activeOrg?.name_2;
  const themeColor = appContext?.activeOrg?.theme_color;
  const activeOrgId = appContext?.active_org_id ?? null;
  const activeBranchId = appContext?.active_branch_id ?? null;

  // 🔄 Dynamiczne ładowanie modułów (np. z Supabase)
  const modules = await getAllModules(activeOrgId);

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
      <AppSidebarHeader logo={logo} name={name} name2={name2} />

      <SidebarContent className="flex h-full flex-col justify-between">
        <ScrollArea className="min-h-full">
          <div className="flex flex-col gap-8 px-3 py-4">
            {modules.map((module) => (
              <ModuleSectionWrapper
                key={module.id}
                module={module}
                accessToken={accessToken}
                activeOrgId={activeOrgId}
                activeBranchId={activeBranchId}
              />
            ))}
          </div>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="flex items-center justify-center border-t border-white/10 px-3 py-1 text-xs text-[color:var(--font-color)] opacity-50">
        Version: {appVersion}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
