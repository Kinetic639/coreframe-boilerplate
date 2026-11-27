"use client";

import {
  Check,
  ExternalLink,
  Globe,
  LayoutGrid,
  MessageSquareText,
  Star,
  Store,
  Warehouse,
} from "lucide-react";
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
  labels: {
    trigger: string;
    title: string;
    current: string;
    website: string;
    /** Star button: "open <app> straight after sign-in" and its opposite. */
    makeDefault?: (appName: string) => string;
    removeDefault?: (appName: string) => string;
    /** Under the default app's name. */
    isDefault?: string;
  };
  websiteHref: string;
  /** App opened straight after sign-in, marked with a filled star. */
  defaultApp?: AppSwitcherAppId | null;
  /** Shows the star on each app; called with the new default, or null to clear it. */
  onDefaultAppChange?: (app: AppSwitcherAppId | null) => void;
  className?: string;
};

function hostOf(href: string): string {
  try {
    return new URL(href).host.replace(/^www\./, "");
  } catch {
    return href;
  }
}

/**
 * The grid button in every Ambra app's header: the apps this user may open
 * (one rule, `get_my_ambra_apps`), the current one marked, a star to pick the app
 * opened after sign-in, plus the public site (new tab).
 */
export function AppSwitcher({
  items,
  currentApp,
  labels,
  websiteHref,
  defaultApp = null,
  onDefaultAppChange,
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
          const isDefault = item.id === defaultApp;
          const starLabel = isDefault
            ? labels.removeDefault?.(item.name)
            : labels.makeDefault?.(item.name);
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-1 rounded-lg pr-1",
                isCurrent && "bg-amber-50 dark:bg-amber-500/10"
              )}
            >
              <DropdownMenuItem asChild className="min-w-0 flex-1 gap-3 rounded-lg p-2.5">
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
                      {isCurrent
                        ? labels.current
                        : isDefault && labels.isDefault
                          ? labels.isDefault
                          : item.description}
                    </span>
                  </span>
                  {isCurrent ? (
                    <Check className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  ) : null}
                </a>
              </DropdownMenuItem>
              {onDefaultAppChange ? (
                <DropdownMenuItem
                  role="menuitemcheckbox"
                  aria-checked={isDefault}
                  aria-label={starLabel}
                  title={starLabel}
                  onSelect={(event) => {
                    // Keep the menu open so the new default is visible.
                    event.preventDefault();
                    onDefaultAppChange(isDefault ? null : item.id);
                  }}
                  className="h-8 w-8 shrink-0 justify-center rounded-md p-0 text-muted-foreground"
                >
                  <Star
                    className={cn(
                      "h-4 w-4",
                      isDefault &&
                        "fill-amber-400 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
                    )}
                  />
                </DropdownMenuItem>
              ) : null}
            </div>
          );
        })}
        <DropdownMenuSeparator className="my-1.5" />
        <DropdownMenuItem asChild className="gap-3 rounded-lg p-2.5">
          <a href={websiteHref} target="_blank" rel="noopener noreferrer">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70">
              <Globe className="h-5 w-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">{labels.website}</span>
              <span className="truncate text-xs text-muted-foreground">{hostOf(websiteHref)}</span>
            </span>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
