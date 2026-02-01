"use client";

import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
  SidebarInset,
} from "@/components/ui/sidebar";
import { NavMain, type NavItemLevel1 } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import { SidebarBranchSwitcher } from "./sidebar-branch-switcher";
import { BookOpen, Bot, Frame, Map, PieChart, Settings2, SquareTerminal } from "lucide-react";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { getUserDisplayName } from "@/utils/user-helpers";
import { DashboardStatusBar } from "@/components/Dashboard/DashboardStatusBar";
import { DashboardHeaderV2 } from "@/components/v2/layout/dashboard-header";

// Sample nav data with up to 3 levels of nesting
const navData: {
  navMain: NavItemLevel1[];
  projects: { name: string; url: string; icon: typeof Frame }[];
} = {
  navMain: [
    {
      title: "Playground",
      url: "#",
      icon: SquareTerminal,
      isActive: true,
      items: [
        { title: "History", url: "#" },
        { title: "Starred", url: "#" },
        {
          title: "Advanced",
          url: "#",
          isActive: true,
          items: [
            { title: "Experiments", url: "#" },
            { title: "Sandbox", url: "#" },
            { title: "Debug Tools", url: "#" },
          ],
        },
      ],
    },
    {
      title: "Models",
      url: "#",
      icon: Bot,
      items: [
        { title: "Genesis", url: "#" },
        {
          title: "Explorer",
          url: "#",
          items: [
            { title: "Data Explorer", url: "#" },
            { title: "Query Builder", url: "#" },
            { title: "Visualizer", url: "#" },
          ],
        },
        {
          title: "Quantum",
          url: "#",
          items: [
            { title: "Algorithms", url: "#" },
            { title: "Simulations", url: "#" },
          ],
        },
      ],
    },
    {
      title: "Documentation",
      url: "#",
      icon: BookOpen,
      items: [
        { title: "Introduction", url: "#" },
        {
          title: "Get Started",
          url: "#",
          items: [
            { title: "Installation", url: "#" },
            { title: "Quick Start", url: "#" },
            { title: "Configuration", url: "#" },
          ],
        },
        {
          title: "Tutorials",
          url: "#",
          items: [
            { title: "Beginner", url: "#" },
            { title: "Intermediate", url: "#" },
            { title: "Advanced", url: "#" },
          ],
        },
        { title: "Changelog", url: "#" },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
      items: [
        { title: "General", url: "#" },
        {
          title: "Team",
          url: "#",
          items: [
            { title: "Members", url: "#" },
            { title: "Roles", url: "#" },
            { title: "Permissions", url: "#" },
          ],
        },
        {
          title: "Billing",
          url: "#",
          items: [
            { title: "Plans", url: "#" },
            { title: "Invoices", url: "#" },
            { title: "Payment Methods", url: "#" },
          ],
        },
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

function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="bg-muted border-b">
        <SidebarBranchSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navData.navMain} />
        <NavProjects projects={navData.projects} />
      </SidebarContent>
      <SidebarFooter className="bg-muted border-t">
        <NavUser user={userData} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col">
        <DashboardHeaderV2 />
        <main className="flex-1 overflow-auto p-4 pb-12">{children}</main>
        <DashboardStatusBar />
      </SidebarInset>
    </SidebarProvider>
  );
}
