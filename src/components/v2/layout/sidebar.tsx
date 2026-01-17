"use client";

import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { BranchSwitcherV2 } from "./branch-switcher";
import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { Home, Package, Users, Settings, HelpCircle } from "lucide-react";

// Map module slugs to their icons
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  warehouse: Package,
  teams: Users,
  "organization-management": Settings,
  support: HelpCircle,
};

/**
 * Sidebar V2
 *
 * Navigation sidebar for Dashboard V2
 *
 * Features:
 * - Organization name in header
 * - Branch switcher
 * - Module navigation from useAppStoreV2.userModules
 * - Active state detection via pathname
 * - Icon mapping for module slugs
 *
 * Uses shadcn/ui Sidebar component
 */
export function SidebarV2() {
  const { userModules, activeOrg } = useAppStoreV2();
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="font-bold text-lg truncate">{activeOrg?.name || "Dashboard"}</div>
        <BranchSwitcherV2 />
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {userModules.map((module) => {
            const Icon = iconMap[module.slug] || Home;
            const href = `/dashboard-v2/${module.slug}`;
            const isActive = pathname.startsWith(href);

            return (
              <SidebarMenuItem key={module.id}>
                <SidebarMenuButton asChild isActive={isActive}>
                  <Link href={href as any}>
                    <Icon className="h-4 w-4" />
                    <span>{module.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="text-xs text-muted-foreground">V2 Dashboard</div>
      </SidebarFooter>
    </Sidebar>
  );
}
