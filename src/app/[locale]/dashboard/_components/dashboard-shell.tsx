"use client";

import {
  SidebarProvider,
  useSidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import { SidebarBranchSwitcher } from "./sidebar-branch-switcher";
import { BookOpen, Bot, Frame, Map, PieChart, Settings2, SquareTerminal } from "lucide-react";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { getUserDisplayName } from "@/utils/user-helpers";
import { DashboardStatusBar } from "@/components/Dashboard/DashboardStatusBar";
import { DashboardHeaderV2 } from "@/components/v2/layout/dashboard-header";

// Sample nav data - will be replaced with real module data later
const navData = {
  navMain: [
    {
      title: "Playground",
      url: "#",
      icon: SquareTerminal,
      isActive: true,
      items: [
        { title: "History", url: "#" },
        { title: "Starred", url: "#" },
        { title: "Settings", url: "#" },
      ],
    },
    {
      title: "Models",
      url: "#",
      icon: Bot,
      items: [
        { title: "Genesis", url: "#" },
        { title: "Explorer", url: "#" },
        { title: "Quantum", url: "#" },
      ],
    },
    {
      title: "Documentation",
      url: "#",
      icon: BookOpen,
      items: [
        { title: "Introduction", url: "#" },
        { title: "Get Started", url: "#" },
        { title: "Tutorials", url: "#" },
        { title: "Changelog", url: "#" },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
      items: [
        { title: "General", url: "#" },
        { title: "Team", url: "#" },
        { title: "Billing", url: "#" },
        { title: "Limits", url: "#" },
      ],
    },
  ],
  projects: [
    { name: "Design Engineering", url: "#", icon: Frame },
    { name: "Sales & Marketing", url: "#", icon: PieChart },
    { name: "Travel", url: "#", icon: Map },
  ],
};

function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user } = useUserStoreV2();

  const userData = user
    ? {
        name: getUserDisplayName(user.first_name, user.last_name),
        email: user.email || "",
        avatar: user.avatar_url || "",
      }
    : {
        name: "User",
        email: "",
        avatar: "",
      };

  return (
    <aside
      className="group shrink-0 bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-200 ease-linear border-r border-sidebar-border"
      style={{ width: isCollapsed ? "var(--sidebar-width-icon)" : "var(--sidebar-width)" }}
      data-state={state}
      data-collapsible={isCollapsed ? "icon" : ""}
      data-variant="sidebar"
      data-side="left"
    >
      <div data-sidebar="sidebar" className="flex h-full w-full flex-col">
        <SidebarHeader>
          <SidebarBranchSwitcher />
        </SidebarHeader>
        <SidebarContent>
          <NavMain items={navData.navMain} />
          <NavProjects projects={navData.projects} />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={userData} />
        </SidebarFooter>
        <SidebarRail />
      </div>
    </aside>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      className="fixed inset-0 !min-h-0"
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3rem",
        } as React.CSSProperties
      }
    >
      <div className="flex h-full w-full">
        <AppSidebar />

        <div className="flex flex-1 flex-col min-h-0 bg-background">
          <DashboardHeaderV2 />
          <main className="flex-1 overflow-auto p-4">{children}</main>
          <DashboardStatusBar />
        </div>
      </div>
    </SidebarProvider>
  );
}
