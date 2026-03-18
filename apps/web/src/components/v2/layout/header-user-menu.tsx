"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Settings, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/app/[locale]/actions";

/**
 * Header User Menu Component
 *
 * User profile dropdown menu in dashboard header
 *
 * Features:
 * - User avatar (or initials fallback)
 * - User name and email in dropdown header
 * - Profile link
 * - Settings link
 * - Sign out action
 *
 * Uses data from useUserStoreV2 (hydrated from server)
 * Implements sign out via server action
 */
export function HeaderUserMenu() {
  const { user } = useUserStoreV2();
  const t = useTranslations("dashboard.header.userMenu");

  if (!user) {
    return null;
  }

  // Generate user initials
  const getInitials = () => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user.first_name) {
      return user.first_name[0].toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  // Generate display name
  const getDisplayName = () => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user.first_name) {
      return user.first_name;
    }
    return user.email;
  };

  const initials = getInitials();
  const displayName = getDisplayName();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 rounded-full"
          aria-label="Open user menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar_url || undefined} alt="User avatar" />
            <AvatarFallback className="bg-muted text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/account/profile" className="flex items-center cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            <span>{t("profile")}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/account/preferences" className="flex items-center cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>{t("preferences")}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={signOutAction} className="w-full">
            <button type="submit" className="flex w-full items-center text-left">
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t("signOut")}</span>
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
