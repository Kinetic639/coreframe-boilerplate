"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./utils";

export type AppTransitionScreenProps = {
  /** Main line, e.g. "Otwieramy ERP…". */
  title: string;
  /** Optional second line under the title. */
  hint?: string;
  /** Icon of the app being opened, shown in its coloured tile. */
  icon?: LucideIcon;
  /** Tile colours of the app (see AMBRA_APP_LOOK). */
  tileClassName?: string;
};

/**
 * Full-page "we are taking you there" screen, shown from the click until the
 * browser unloads the page. Cross-subdomain navigation (sign-in → chooser →
 * app, switching apps) is a full page load that can take seconds; without this
 * the page looks frozen and people click again. Portalled to <body> so a
 * header with backdrop blur or a closing menu cannot clip or unmount it.
 */
export function AppTransitionScreen({
  title,
  hint,
  icon: Icon,
  tileClassName,
}: AppTransitionScreenProps) {
  // Only ever shown after a click, never during server rendering.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="app-transition-screen"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 px-6 text-foreground backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150"
    >
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        {Icon ? (
          <span
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-xl",
              tileClassName ?? "bg-muted text-foreground"
            )}
          >
            <Icon className="h-7 w-7" strokeWidth={1.8} />
          </span>
        ) : null}
        <div className="flex items-center gap-2.5">
          <Loader2
            aria-hidden="true"
            className="h-5 w-5 shrink-0 animate-spin text-amber-600 dark:text-amber-400"
          />
          <p className="m-0 text-base font-semibold">{title}</p>
        </div>
        {hint ? <p className="m-0 text-sm text-muted-foreground">{hint}</p> : null}
      </div>
    </div>,
    document.body
  );
}

/** True for a plain left click; ctrl/cmd/shift/middle clicks open a new tab and keep this page. */
export function isPlainLeftClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * Tracks a full-page navigation that is under way: `start(key, href)` marks it
 * pending and asks the browser to go; `pending` stays set until the page
 * unloads. Coming back with the browser's Back button (page restored from the
 * back/forward cache) clears it so the page is usable again.
 */
export function usePendingNavigation<Key extends string = string>() {
  const [pending, setPending] = useState<Key | null>(null);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(null);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const start = useCallback((key: Key, href?: string) => {
    setPending(key);
    if (href) window.location.assign(href);
  }, []);

  return { pending, start };
}
