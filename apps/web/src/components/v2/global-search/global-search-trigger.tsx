"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGlobalSearchStore } from "./global-search-store";

interface GlobalSearchTriggerProps {
  /** "bar": wide search field (desktop header), "icon": icon button (mobile) */
  variant: "bar" | "icon";
}

/** Opens the global search palette. The palette itself is mounted once (GlobalSearchDialog). */
export function GlobalSearchTrigger({ variant }: GlobalSearchTriggerProps) {
  const t = useTranslations("globalSearch");
  const setOpen = useGlobalSearchStore((s) => s.setOpen);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));
  }, []);

  const shortcut = isMac ? "⌘K" : "Ctrl K";
  const ariaLabel = t("triggerAria", { shortcut });

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <Search className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={ariaLabel}
      className="flex h-9 w-full items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate text-left">{t("triggerLabel")}</span>
      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium">
        {shortcut}
      </kbd>
    </button>
  );
}
