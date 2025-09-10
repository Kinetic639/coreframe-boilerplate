"use client";

import { useEffect } from "react";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { MenuItem } from "@/lib/types/module";

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

export function SidebarInitializer({ modules }: SidebarInitializerProps) {
  const { setAvailableSections } = useSidebarStore();

  useEffect(() => {
    const allSectionIds: string[] = [];

    modules.forEach((module) => {
      // Add the main module section
      allSectionIds.push(`module-${module.slug}`);

      // Add all nested section IDs
      const nestedIds = collectAllSectionIds(module.items, module.slug);
      allSectionIds.push(...nestedIds);
    });

    setAvailableSections(allSectionIds);
  }, [modules, setAvailableSections]);

  return null; // This component doesn't render anything
}
