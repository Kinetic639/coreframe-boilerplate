"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { signOutAction } from "@/app/actions/auth";

export function UserMenu({
  displayName,
  email,
  initials,
}: {
  displayName: string;
  email: string;
  initials: string;
}) {
  const t = useTranslations();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("portal.account", { name: displayName })}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-xs font-semibold text-amber-900 outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">{displayName}</span>
          <span className="text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOutAction()} className="gap-2">
          <LogOut className="h-4 w-4" />
          {t("auth.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
