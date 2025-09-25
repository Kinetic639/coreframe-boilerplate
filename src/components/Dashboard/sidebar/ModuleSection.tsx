"use client";

import * as Icons from "lucide-react";
import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { MenuItem as MenuItemType } from "@/lib/types/module";
import { TreeMenuItem } from "./TreeMenuItem";
import { useCurrentPath } from "@/hooks/useCurrentPath";
import { checkIsActive } from "@/utils/sidebar/active-detection";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ModuleSectionProps {
  module: {
    slug: string;
    title: string;
    icon?: string;
    items: MenuItemType[];
  };
  hasActiveItemInAnyModule?: boolean;
}

export function ModuleSection({ module, hasActiveItemInAnyModule = false }: ModuleSectionProps) {
  const { state } = useSidebar();
  const { openSections, toggleSection, mode } = useSidebarStore();
  const isExpanded = state === "expanded";
  const pathname = useCurrentPath();

  // Module section ID for state persistence
  const sectionId = `module-${module.slug}`;
  const isOpen = openSections.includes(sectionId);

  // Check if this module has any active items
  const hasActiveItem = checkIsActive(module.items, pathname);

  // Should this module header be grayed out?
  const shouldGrayOutModule = hasActiveItemInAnyModule && !hasActiveItem;

  // Should tooltips be shown?
  // Only show tooltips when sidebar is collapsed AND in manual mode (not auto mode)
  const shouldShowTooltip = !isExpanded && mode === "manual";

  // Get module icon
  const ModuleIcon = (Icons as any)[module.icon || "Folder"] || Icons.Folder;

  if (module.items.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      {/* Module Header */}
      <TooltipProvider>
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <div
              onClick={() => toggleSection(sectionId)}
              className={cn(
                "relative mb-1 flex cursor-pointer items-center rounded-md px-2 py-1.5 font-medium transition-all duration-200 hover:bg-[color-mix(in_srgb,var(--font-color)_10%,transparent)]",
                "text-[color:var(--font-color)] hover:text-[color:var(--font-color)]",
                shouldGrayOutModule && "brightness-75 filter"
              )}
              style={{
                paddingRight: isExpanded ? "32px" : "8px", // Reserve space for chevron when expanded
              }}
            >
              <ModuleIcon className="h-4 w-4 shrink-0 text-[color:var(--font-color)]" />

              <AnimatePresence mode="wait">
                {isExpanded && (
                  <motion.div
                    key="expanded-module"
                    initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                    animate={{ opacity: 1, width: "auto", marginLeft: 8 }}
                    exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="flex w-full flex-1 items-center overflow-hidden"
                  >
                    <span className="flex-1 overflow-hidden whitespace-nowrap text-sm">
                      {module.title}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chevron positioned absolutely to align with all other chevrons */}
              <ChevronRight
                className={cn(
                  "absolute right-2 h-3 w-3 shrink-0 text-[color:var(--font-color)] transition-transform duration-200",
                  isExpanded ? isOpen && "rotate-90" : isOpen && "rotate-90",
                  !isExpanded && "relative right-auto ml-3"
                )}
              />
            </div>
          </TooltipTrigger>
          {shouldShowTooltip && (
            <TooltipContent
              side="right"
              className="z-[9999] border-[color-mix(in_srgb,var(--font-color)_20%,transparent)] bg-[color:var(--font-color)] text-[color:var(--sidebar-bg)] shadow-lg"
            >
              {module.title}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {/* Module Menu Items */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 overflow-hidden"
          >
            <div className="space-y-0.5">
              {module.items.map((item, index) => {
                const isLastItem = index === module.items.length - 1;
                return (
                  <TreeMenuItem
                    key={item.id}
                    item={item}
                    moduleSlug={module.slug}
                    level={1}
                    isLast={isLastItem}
                    parentLevels={[!isLastItem]}
                    hasActiveItemInModule={hasActiveItem}
                    hasActiveItemInAnyModule={hasActiveItemInAnyModule}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
