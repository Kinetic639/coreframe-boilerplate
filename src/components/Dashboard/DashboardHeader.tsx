import React from "react";
import LocaleSwitcher from "../LocaleSwitcher";
import { ThemeSwitcher } from "../theme-switcher";
import { SidebarTrigger } from "../ui/sidebar";
import { Button } from "../ui/button";
import { Bell, LogOut, MessagesSquare, Settings, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { BranchSelector } from "./BranchSelector";

const DashboardHeader = () => {
  return (
    <header className="sticky top-0 z-20 flex flex-col bg-background">
      <div className="flex h-14 w-full items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger variant="themed" />
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
                  <AvatarImage src="/placeholder-avatar.jpg" alt="User" />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Jan Kowalski</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    jan.kowalski@example.com
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profil</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Ustawienia</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LocaleSwitcher />
                <ThemeSwitcher />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Wyloguj</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
