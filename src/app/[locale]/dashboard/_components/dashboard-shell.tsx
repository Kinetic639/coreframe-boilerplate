"use client";

import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import { SidebarBranchSwitcher } from "./sidebar-branch-switcher";
import { SearchBar } from "@/components/Dashboard/header/SearchBar";
import {
  BookOpen,
  Bot,
  Frame,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
  Bell,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/lib/stores/user-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/app/[locale]/actions";
import { getUserInitials, getUserDisplayName } from "@/utils/user-helpers";
import { User, Settings, LogOut } from "lucide-react";
import { DashboardStatusBar } from "@/components/Dashboard/DashboardStatusBar";

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
  const { user } = useUserStore();

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

function DashboardHeader() {
  const { user } = useUserStore();

  if (!user) return null;

  const displayName = getUserDisplayName(user.first_name, user.last_name);
  const displayEmail = user.email || "No email";
  const userInitials = getUserInitials(user.first_name, user.last_name, displayEmail);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <SearchBar />
      </div>

      <div className="flex items-center gap-2">
        {/* Quick Add */}
        <Button variant="default" size="sm" className="h-9 w-9 p-0">
          <Plus className="h-5 w-5" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
          <Bell className="h-4 w-4" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.avatar_url || undefined} alt="User" />
                <AvatarFallback className="bg-muted">{userInitials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">{displayEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard-old/account/profile" className="flex items-center">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard-old/account/preferences" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                <span>Preferences</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action={signOutAction} className="w-full">
                <button type="submit" className="flex w-full items-center text-left">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3rem",
        } as React.CSSProperties
      }
    >
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />

        <div className="flex flex-1 flex-col min-h-0 bg-background">
          <DashboardHeader />
          <main className="flex-1 overflow-auto p-4">{children}</main>
          <DashboardStatusBar />
        </div>
      </div>
    </SidebarProvider>
  );
}
