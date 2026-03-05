"use client";

import {
  ActivitySquare,
  BadgeCheck,
  ChevronsUpDown,
  Home,
  LayoutDashboard,
  LogOut,
  Shield,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { createClient } from "@/utils/supabase/client";
import { useRouter, usePathname } from "@/i18n/navigation";

export function NavUser({
  user,
  isAdmin = false,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
  isAdmin?: boolean;
}) {
  const { isMobile } = useSidebar();

  const initials =
    user.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "?";
  const router = useRouter();
  const pathname = usePathname();
  const isInAdminPanel = pathname.startsWith("/admin");
  const isOnDiagnostics = pathname.startsWith("/dashboard/diagnostics");

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
  };

  const handleGoToAccount = () => {
    router.push("/dashboard/account");
  };

  const handleGoHome = () => {
    router.push("/");
  };

  const handleGoToAdmin = () => {
    router.push("/admin");
  };

  const handleGoToDashboard = () => {
    router.push("/dashboard/start");
  };

  const handleGoToDiagnostics = () => {
    router.push("/dashboard/diagnostics");
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleGoHome}>
                <Home />
                Home
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleGoToAccount}>
                <BadgeCheck />
                Account
              </DropdownMenuItem>
              {isAdmin &&
                (isInAdminPanel ? (
                  <DropdownMenuItem onClick={handleGoToDashboard}>
                    <LayoutDashboard />
                    Dashboard
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleGoToAdmin}>
                    <Shield />
                    Admin Panel
                  </DropdownMenuItem>
                ))}
              {isAdmin && !isOnDiagnostics && (
                <DropdownMenuItem onClick={handleGoToDiagnostics}>
                  <ActivitySquare />
                  Diagnostics
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
