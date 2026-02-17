"use client";

import { useEffect } from "react";
import type { SidebarModel } from "@/lib/types/v2/sidebar";
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
import { SidebarOrgHeader } from "./sidebar-org-header";
import {
  BookOpen,
  Bot,
  Brain,
  Bug,
  Clock,
  CreditCard,
  Database,
  FileText,
  FlaskConical,
  Frame,
  GraduationCap,
  Map,
  PieChart,
  Play,
  Receipt,
  Search,
  Settings2,
  Shield,
  SquareTerminal,
  Star,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
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
        { title: "History", url: "#", icon: Clock },
        { title: "Starred", url: "#", icon: Star },
        {
          title: "Advanced",
          url: "#",
          icon: Wrench,
          isActive: true,
          items: [
            { title: "Experiments", url: "#", icon: FlaskConical },
            { title: "Sandbox", url: "#", icon: Play },
            { title: "Debug Tools", url: "#", icon: Bug },
          ],
        },
      ],
    },
    {
      title: "Models",
      url: "#",
      icon: Bot,
      items: [
        { title: "Genesis", url: "#", icon: Zap },
        {
          title: "Explorer",
          url: "#",
          icon: Search,
          items: [
            { title: "Data Explorer", url: "#", icon: Database },
            { title: "Query Builder", url: "#" },
            { title: "Visualizer", url: "#", icon: PieChart },
          ],
        },
        {
          title: "Quantum",
          url: "#",
          icon: Brain,
          items: [
            { title: "Algorithms", url: "#", icon: FlaskConical },
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
        { title: "Introduction", url: "#", icon: FileText },
        {
          title: "Get Started",
          url: "#",
          icon: Play,
          items: [
            { title: "Installation", url: "#" },
            { title: "Quick Start", url: "#", icon: Zap },
            { title: "Configuration", url: "#", icon: Settings2 },
          ],
        },
        {
          title: "Tutorials",
          url: "#",
          icon: GraduationCap,
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
        { title: "General", url: "#", icon: Wrench },
        {
          title: "Team",
          url: "#",
          icon: Users,
          items: [
            { title: "Members", url: "#", icon: Users },
            { title: "Roles", url: "#" },
            { title: "Permissions", url: "#", icon: Shield },
          ],
        },
        {
          title: "Billing",
          url: "#",
          icon: CreditCard,
          items: [
            { title: "Plans", url: "#" },
            { title: "Invoices", url: "#", icon: Receipt },
            { title: "Payment Methods", url: "#", icon: CreditCard },
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

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  model: SidebarModel;
}

function AppSidebar({ model: _model, ...props }: AppSidebarProps) {
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

  // -------------------------------------------------------------------------
  // PHASE 4 WIRING — model is computed + passed through, NOT rendered yet.
  //
  // The `model` prop contains a permission-filtered SidebarModel from SSR.
  // It is intentionally unused here — the rendering below still uses `navData`
  // which is temporary placeholder data and does NOT enforce
  // entitlements or permissions.
  //
  // PHASE 5 will replace NavMain/NavProjects with a model-driven renderer.
  // Until then, the sidebar does NOT reflect actual access control.
  // -------------------------------------------------------------------------

  // Dev-only one-time warning so it is obvious the model is not rendered yet.
  // Runs once per mount; no production impact.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[Sidebar V2] Phase 4: model is wired but not rendered yet. " +
          "Phase 5 will replace navData with model-based rendering. " +
          "Current UI does NOT enforce entitlements or permissions."
      );
    }
  }, []);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="bg-muted border-b">
        <SidebarOrgHeader />
        <SidebarBranchSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {/* TODO Phase 5: replace navData with model.main items */}
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

interface DashboardShellProps {
  children: React.ReactNode;
  sidebarModel: SidebarModel;
}

export function DashboardShell({ children, sidebarModel }: DashboardShellProps) {
  // Read sidebar collapsed state from Zustand (persisted in localStorage)
  const sidebarCollapsed = useUiStoreV2((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStoreV2((s) => s.setSidebarCollapsed);

  // Sync sidebar state changes back to Zustand store
  // Using controlled mode (open prop) for proper state synchronization
  const handleSidebarOpenChange = (open: boolean) => {
    setSidebarCollapsed(!open);
  };

  return (
    <SidebarProvider open={!sidebarCollapsed} onOpenChange={handleSidebarOpenChange}>
      <AppSidebar model={sidebarModel} />
      <SidebarInset className="flex flex-col">
        <DashboardHeaderV2 />
        <main className="flex-1 overflow-auto p-4 pb-12">{children}</main>
        <DashboardStatusBar />
      </SidebarInset>
    </SidebarProvider>
  );
}
