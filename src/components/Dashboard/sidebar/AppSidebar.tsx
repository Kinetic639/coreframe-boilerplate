import React from "react";
import { Sidebar, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";
import AppSidebarHeader from "./AppSidebarHeader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { appVersion } from "@/lib/version";
import ModuleSectionWrapper from "./ModuleSectionWrapper";
import { createClient } from "@/utils/supabase/server";
import { getAllModules } from "@/modules";

const AppSidebar = async () => {
  const appContext = await loadAppContextServer();
  const userContext = await loadUserContextServer();
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token ?? "";

  const logo = appContext?.activeOrg?.logo_url;
  const name = appContext?.activeOrg?.name;
  const name2 = appContext?.activeOrg?.name_2;
  const themeColor = appContext?.activeOrg?.theme_color;
  const activeOrgId = appContext?.activeOrgId ?? null;
  const activeBranchId = appContext?.activeBranchId ?? null;
  const userPermissions = userContext?.permissions ?? [];

  // 🔄 Dynamiczne ładowanie modułów (np. z Supabase)
  const modules = await getAllModules();

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
      <AppSidebarHeader
        logo={logo || undefined}
        name={name || undefined}
        name2={name2 || undefined}
      />

      <SidebarContent className="flex h-full flex-col justify-between">
        <ScrollArea className="min-h-full">
          <div className="flex flex-col gap-4 px-3 py-0">
            {modules.map((module) => (
              <React.Fragment key={module.id}>
                {/* {index > 0 && (
                  <Separator className="my-4 bg-[color:var(--font-color)] opacity-20" />
                )} */}
                <ModuleSectionWrapper
                  module={module}
                  accessToken={accessToken}
                  activeOrgId={activeOrgId}
                  activeBranchId={activeBranchId}
                  userPermissions={userPermissions}
                />
              </React.Fragment>
            ))}
          </div>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="flex items-center justify-center border-t border-white/10 px-3 py-1 text-xs text-[color:var(--font-color)] opacity-50">
        Besio version: {appVersion}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
