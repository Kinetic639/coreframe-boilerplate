"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search } from "lucide-react";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useRouter } from "next/navigation";

/**
 * Header Search Component
 *
 * Global search with command palette (Cmd+K / Ctrl+K)
 *
 * Features:
 * - Desktop: Search button with text
 * - Mobile: Search icon only
 * - Keyboard shortcut: Cmd+K / Ctrl+K
 * - Searches through module navigation items
 * - Filtered by permissions (userModules already filtered server-side)
 * - Closes on selection and navigates
 *
 * Uses shadcn/ui Command component
 */
export function HeaderSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { userModules } = useAppStoreV2();
  // const t = useTranslations("dashboard.header.search"); // TODO: Add translations for search placeholder

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Generate search commands from modules
  const commands = useMemo(() => {
    return userModules.map((module) => ({
      id: module.id,
      label: module.label,
      slug: module.slug,
      href: `/dashboard/${module.slug}`,
    }));
  }, [userModules]);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      {/* Desktop: Full search button */}
      <Button
        variant="outline"
        className="hidden md:flex w-full justify-start text-sm text-muted-foreground h-9"
        onClick={() => setOpen(true)}
        aria-label="Search (Ctrl+K)"
      >
        <Search className="mr-2 h-4 w-4" />
        <span>Search...</span>
        <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* Mobile: Icon only */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-9 w-9"
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </Button>

      {/* Command Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {commands.map((cmd) => (
              <CommandItem
                key={cmd.id}
                onSelect={() => handleSelect(cmd.href)}
                className="cursor-pointer"
              >
                <Search className="mr-2 h-4 w-4" />
                {cmd.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
