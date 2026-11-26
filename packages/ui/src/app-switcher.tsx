"use client";

import { Check, Globe, LayoutGrid, MessageSquareText, Store, Warehouse } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { cn } from "./utils";

export type AppSwitcherAppId = "erp" | "requests" | "vmi";

export type AppSwitcherItem = {
  id: AppSwitcherAppId;
  name: string;
  description: string;
  href: string;
};

/** Icon and colours of each Ambra app, shared by the switcher and the app chooser. */
export const AMBRA_APP_LOOK: Record<AppSwitcherAppId, { icon: LucideIcon; tile: string }> = {
  erp: {
    icon: Warehouse,
    tile: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  },
  requests: {
    icon: MessageSquareText,
    tile: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  },
  vmi: {
    icon: Store,
    tile: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
};

export type AppSwitcherProps = {
  items: AppSwitcherItem[];
  currentApp: AppSwitcherAppId;
  labels: { trigger: string; title: string; current: string; website: string; chooser?: string };
  websiteHref: string;
  /** The app chooser, where the user can also stop opening the last app by default. */
  chooserHref?: string;
  className?: string;
};

/**
 * The grid button in every Ambra app's header: the apps this user may open
 * (one rule, `get_my_ambra_apps`), the current one marked, plus the public site.
 */
export function AppSwitcher({
  items,
  currentApp,
  labels,
  websiteHref,
  chooserHref,
  className,
}: AppSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={labels.trigger}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-amber-100 data-[state=open]:text-amber-800 dark:data-[state=open]:bg-amber-500/15 dark:data-[state=open]:text-amber-300",
          className
        )}
      >
        <LayoutGrid className="h-[18px] w-[18px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-80 p-2">
        <DropdownMenuLabel className="px-2.5 pb-1.5 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {labels.title}
        </DropdownMenuLabel>
        {items.map((item) => {
          const look = AMBRA_APP_LOOK[item.id];
          const Icon = look.icon;
          const isCurrent = item.id === currentApp;
          return (
            <DropdownMenuItem
              key={item.id}
              asChild
              className={cn(
                "gap-3 rounded-lg p-2.5",
                isCurrent && "bg-amber-50 dark:bg-amber-500/10"
              )}
            >
              <a href={item.href} aria-current={isCurrent ? "page" : undefined}>
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    look.tile
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{item.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {isCurrent ? labels.current : item.description}
                  </span>
                </span>
                {isCurrent ? (
                  <Check className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                ) : null}
              </a>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator className="my-1.5" />
        {chooserHref && labels.chooser ? (
          <DropdownMenuItem asChild className="gap-2.5 rounded-md px-2.5 py-2">
            <a href={chooserHref}>
              <LayoutGrid className="h-4 w-4" />
              {labels.chooser}
            </a>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild className="gap-2.5 rounded-md px-2.5 py-2">
          <a href={websiteHref}>
            <Globe className="h-4 w-4" />
            {labels.website}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
