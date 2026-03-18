"use client";

import { useEffect } from "react";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { MenuItem } from "@/lib/types/module";
import { useCurrentPath } from "@/hooks/useCurrentPath";
import { checkIsActive } from "@/utils/sidebar/active-detection";

interface SidebarInitializerProps {
  modules: Array<{ slug: string; items: MenuItem[] }>;
}

// Recursive function to collect all section IDs from menu items
function collectAllSectionIds(items: MenuItem[], moduleSlug: string): string[] {
  const sectionIds: string[] = [];

  items.forEach((item) => {
    // Only collect IDs for items with submenu (sections that can be expanded)
    if ("submenu" in item && item.submenu && item.submenu.length > 0) {
      const sectionId = `${moduleSlug}-${item.id}`;
      sectionIds.push(sectionId);

      // Recursively collect from submenu
      const childIds = collectAllSectionIds(item.submenu, moduleSlug);
      sectionIds.push(...childIds);
    }
  });

  return sectionIds;
}

// Find the active section based on current pathname
function findActiveSectionId(
  items: MenuItem[],
  moduleSlug: string,
  pathname: string
): string | null {
  if (checkIsActive(items, pathname)) {
    return `module-${moduleSlug}`;
  }
  return null;
}

export function SidebarInitializer({ modules }: SidebarInitializerProps) {
  const pathname = useCurrentPath();
  const { setAvailableSections, setActiveSectionId, initializeSidebar } = useSidebarStore();

  useEffect(() => {
    const allSectionIds: string[] = [];
    let activeSection: string | null = null;

    modules.forEach((module) => {
      // Add the main module section
      allSectionIds.push(`module-${module.slug}`);

      // Add all nested section IDs
      const nestedIds = collectAllSectionIds(module.items, module.slug);
      allSectionIds.push(...nestedIds);

      // Check if this module contains the active path
      if (!activeSection) {
        activeSection = findActiveSectionId(module.items, module.slug, pathname);
      }
    });

    setAvailableSections(allSectionIds);
    setActiveSectionId(activeSection);

    // Initialize the sidebar with current pathname
    initializeSidebar(pathname);
  }, [modules, pathname, setAvailableSections, setActiveSectionId, initializeSidebar]);

  return null; // This component doesn't render anything
}
