"use client";

import React from "react";
import { Button } from "../../ui/button";
import {
  Bell,
  LogOut,
  Settings,
  User,
  MoreVertical,
  MousePointer2,
  Hand,
  Layers,
  Minus,
  Plus,
  Package,
  Users,
  FileText,
  ShoppingCart,
  Warehouse,
  FolderTree,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/app/actions/auth/sign-out";
import { getUserInitials, getUserDisplayName } from "@/utils/user-helpers";
import { useUserStore } from "@/lib/stores/user-store";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { SidebarToggleButton } from "./SidebarToggleButton";
import MessagesDrawer from "@/components/chat/MessagesDrawer";
import { useTranslations } from "next-intl";
import { SearchBar } from "./SearchBar";

const DashboardHeader = () => {
  const { user } = useUserStore();
  const { mode, setMode, sectionMode, setSectionMode } = useSidebarStore();
  const t = useTranslations("dashboard.header.quickAdd");

  if (!user) {
    return null; // or loading state
  }

  const displayName = getUserDisplayName(user.first_name, user.last_name);
  const displayEmail = user.email || "No email";
  const userInitials = getUserInitials(user.first_name, user.last_name, displayEmail);

  return (
    <header className="sticky top-0 z-20 flex flex-col bg-background">
      <div className="relative flex h-14 w-full items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {/* Sidebar Toggle - Absolutely positioned to touch sidebar */}
            <SidebarToggleButton />

            {/* Spacer to account for absolutely positioned button - smaller in auto mode */}
            <div className={mode === "auto" ? "w-0" : "w-4"} />

            {/* Sidebar Options Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost-themed" size="sm" className="h-9 w-9 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[180px]">
                <DropdownMenuLabel>Sidebar Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setMode(mode === "auto" ? "manual" : "auto")}
                  className="flex items-center"
                >
                  {mode === "auto" ? (
                    <>
                      <Hand className="mr-2 h-4 w-4" />
                      Switch to Manual Mode
                    </>
                  ) : (
                    <>
                      <MousePointer2 className="mr-2 h-4 w-4" />
                      Switch to Auto Mode (Hover)
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setSectionMode(sectionMode === "single" ? "multi" : "single")}
                  className="flex items-center"
                >
                  {sectionMode === "single" ? (
                    <>
                      <Layers className="mr-2 h-4 w-4" />
                      Switch to Multi-Section Mode
                    </>
                  ) : (
                    <>
                      <Minus className="mr-2 h-4 w-4" />
                      Switch to Single Section Mode
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <SearchBar />
        </div>

        <div className="flex items-center gap-4">
          {/* Quick Add Dropdown */}
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" size="sm" className="h-9 w-9 p-0">
                      <Plus className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("tooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-[600px] p-4">
              <div className="grid grid-cols-3 gap-6">
                {/* Inventory Column */}
                <div className="space-y-2">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    {t("inventory.title")}
                  </div>
                  <DropdownMenuItem className="cursor-pointer">
                    <Package className="mr-3 h-4 w-4" />
                    <span>{t("inventory.product")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <Warehouse className="mr-3 h-4 w-4" />
                    <span>{t("inventory.location")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <ShoppingCart className="mr-3 h-4 w-4" />
                    <span>{t("inventory.order")}</span>
                  </DropdownMenuItem>
                </div>

                {/* Sales Column */}
                <div className="space-y-2">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    {t("sales.title")}
                  </div>
                  <DropdownMenuItem className="cursor-pointer">
                    <Users className="mr-3 h-4 w-4" />
                    <span>{t("sales.customer")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <FileText className="mr-3 h-4 w-4" />
                    <span>{t("sales.invoice")}</span>
                  </DropdownMenuItem>
                </div>

                {/* Purchases Column */}
                <div className="space-y-2">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    {t("purchases.title")}
                  </div>
                  <DropdownMenuItem className="cursor-pointer">
                    <FolderTree className="mr-3 h-4 w-4" />
                    <span>{t("purchases.supplier")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <FileText className="mr-3 h-4 w-4" />
                    <span>{t("purchases.bill")}</span>
                  </DropdownMenuItem>
                </div>
              </div>

              <DropdownMenuSeparator className="my-3" />

              {/* Other Section */}
              <div className="space-y-2">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {t("other.title")}
                </div>
                <DropdownMenuItem className="cursor-pointer">
                  <FileText className="mr-3 h-4 w-4" />
                  <span>{t("other.document")}</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <MessagesDrawer />
          <Button variant="ghost-themed" size="sm" className="h-9 w-9 p-0">
            <Bell className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost-themed" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-8 w-8 ">
                  <AvatarImage
                    src={user.avatar_url ? String(user.avatar_url) : undefined}
                    alt="User"
                  />
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
                <Link href="/dashboard/account/profile" className="flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/account/preferences" className="flex items-center">
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
      </div>
    </header>
  );
};

export default DashboardHeader;
