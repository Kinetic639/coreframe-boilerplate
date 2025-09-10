"use client";

import { useEffect } from "react";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { MenuItem } from "@/lib/types/module";
import { usePathname } from "@/i18n/navigation";

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
  for (const item of items) {
    // Check if this item or any of its children match the current path
    if ("path" in item && item.path === pathname) {
      // If this item has a parent section, return that section ID
      if ("submenu" in item && item.submenu) {
        return `${moduleSlug}-${item.id}`;
      }
      // If this is a top-level item, return the module section
      return `module-${moduleSlug}`;
    }

    // Check submenu recursively
    if ("submenu" in item && item.submenu) {
      const childResult = findActiveSectionId(item.submenu, moduleSlug, pathname);
      if (childResult) {
        // Found in submenu, so this parent section should also be active
        return `${moduleSlug}-${item.id}`;
      }
    }
  }
  return null;
}

export function SidebarInitializer({ modules }: SidebarInitializerProps) {
  const pathname = usePathname();
  const { setAvailableSections, setActiveSectionId } = useSidebarStore();

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
  }, [modules, pathname, setAvailableSections, setActiveSectionId]);

  return null; // This component doesn't render anything
}
