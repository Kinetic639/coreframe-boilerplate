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

  // Detect OS for correct keyboard shortcut display
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

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

  const shortcutText = isMac ? "⌘K" : "Ctrl+K";

  return (
    <>
      {/* Desktop: Search icon with tooltip */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:flex h-9 w-9"
        onClick={() => setOpen(true)}
        aria-label={`Search (${shortcutText})`}
        title={`Search (${shortcutText})`}
      >
        <Search className="h-5 w-5" />
      </Button>

      {/* Mobile: Search icon */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-9 w-9"
        onClick={() => setOpen(true)}
        aria-label="Search"
        title="Search"
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
