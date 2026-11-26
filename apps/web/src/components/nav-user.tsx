"use client";

import {
  ActivitySquare,
  BadgeCheck,
  Bug,
  ChevronsUpDown,
  Globe,
  Home,
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
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { signOutAction } from "@/app/[locale]/actions";
import { useReportFeedbackStore } from "@/lib/platform-feedback/report-store";
import { appUrl } from "@repo/app-urls";

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
  const t = useTranslations("dashboard.header.userMenu");

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

  const handleGoToAccount = () => {
    router.push("/dashboard/account");
  };

  const handleGoToAdmin = () => {
    router.push("/admin");
  };

  const handleGoToStart = () => {
    router.push("/dashboard/start");
  };

  const openReportFeedback = useReportFeedbackStore((state) => state.setOpen);

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
              {/* "Start" stays in the app; the public website is a separate, labelled link. */}
              <DropdownMenuItem onClick={handleGoToStart}>
                <Home />
                {t("home")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleGoToAccount}>
                <BadgeCheck />
                {t("account")}
              </DropdownMenuItem>
              {isAdmin && !isInAdminPanel && (
                <DropdownMenuItem onClick={handleGoToAdmin}>
                  <Shield />
                  {t("adminPanel")}
                </DropdownMenuItem>
              )}
              {isAdmin && !isOnDiagnostics && (
                <DropdownMenuItem onClick={handleGoToDiagnostics}>
                  <ActivitySquare />
                  {t("diagnostics")}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={appUrl("site")} className="flex items-center gap-2 cursor-default">
                <Globe className="size-4" />
                {t("website")}
              </a>
            </DropdownMenuItem>
            {/* The dialog lives in the dashboard header, not in the admin panel */}
            {!isInAdminPanel && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => openReportFeedback(true)}
                  data-testid="user-menu-report-feedback"
                >
                  <Bug />
                  {t("reportFeedback")}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action={signOutAction} className="w-full">
                <button type="submit" className="flex w-full items-center gap-2 cursor-default">
                  <LogOut className="size-4" />
                  {t("logOut")}
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
