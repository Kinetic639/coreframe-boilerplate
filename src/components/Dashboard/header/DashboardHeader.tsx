"use client";

import React from "react";
import { SidebarTrigger } from "../../ui/sidebar";
import { Button } from "../../ui/button";
import {
  Bell,
  LogOut,
  MessagesSquare,
  Settings,
  User,
  MoreVertical,
  MousePointer2,
  Hand,
  Layers,
  Minus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { BranchSelector } from "./BranchSelector";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/app/actions/auth/sign-out";
import { getUserInitials, getUserDisplayName } from "@/utils/user-helpers";
import { useUserStore } from "@/lib/stores/user-store";
import { useSidebarStore } from "@/lib/stores/sidebarStore";

const DashboardHeader = () => {
  const { user } = useUserStore();
  const { mode, setMode, sectionMode, setSectionMode } = useSidebarStore();

  if (!user) {
    return null; // or loading state
  }

  const displayName = getUserDisplayName(user.first_name, user.last_name);
  const displayEmail = user.email || "No email";
  const userInitials = getUserInitials(user.first_name, user.last_name, displayEmail);

  return (
    <header className="sticky top-0 z-20 flex flex-col bg-background">
      <div className="flex h-14 w-full items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {/* Sidebar Options Dropdown - Always first */}
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

            {/* Hide SidebarTrigger in auto mode - Second position */}
            {mode !== "auto" && <SidebarTrigger variant="themed" />}
          </div>

          <BranchSelector />
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost-themed" size="sm" className="h-9 w-9 p-0">
            <MessagesSquare className="h-4 w-4" />
          </Button>
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
