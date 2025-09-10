import React from "react";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";
import AppSidebarHeader from "./AppSidebarHeader";
import { SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { appVersion } from "@/lib/version";
import { AppSidebarWrapper } from "./AppSidebarWrapper";
import ModuleSectionWrapper from "./ModuleSectionWrapper";
import { SidebarInitializer } from "./SidebarInitializer";
import { createClient } from "@/utils/supabase/server";
import { getAllModules } from "@/modules";
import { getTranslations } from "next-intl/server";

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
  const fontColor = appContext?.activeOrg?.font_color;
  const activeOrgId = appContext?.activeOrgId ?? null;
  const activeBranchId = appContext?.activeBranchId ?? null;
  const userPermissions = userContext?.permissions ?? [];

  // Load modules and translations
  const modules = await getAllModules();
  const t = await getTranslations("modules");

  return (
    <AppSidebarWrapper themeColor={themeColor} fontColor={fontColor}>
      {/* Initialize available sections for expand all functionality */}
      <SidebarInitializer modules={modules} />

      <AppSidebarHeader
        logo={logo || undefined}
        name={name || undefined}
        name2={name2 || undefined}
      />

      <SidebarContent className="overflow-hidden p-0">
        <ScrollArea className="h-full w-full">
          <div className="p-2 pr-3">
            {modules.map((module) => (
              <ModuleSectionWrapper
                key={module.id}
                module={module}
                accessToken={accessToken}
                activeOrgId={activeOrgId ?? undefined}
                activeBranchId={activeBranchId ?? undefined}
                userPermissions={userPermissions}
                translations={t}
              />
            ))}
          </div>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="border-t border-[color-mix(in_srgb,var(--font-color)_20%,transparent)]">
        <div className="flex items-center justify-center px-2 py-1 text-xs text-[color:var(--font-color)]">
          <span className="group-data-[collapsible=icon]:hidden">Besio version: {appVersion}</span>
          <span className="hidden text-[10px] group-data-[collapsible=icon]:block">
            v{appVersion}
          </span>
        </div>
      </SidebarFooter>
    </AppSidebarWrapper>
  );
};

export default AppSidebar;
