"use client";

import * as Icons from "lucide-react";
import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { MenuItem as MenuItemType } from "@/lib/types/module";
import { TreeMenuItem } from "./TreeMenuItem";

interface ModuleSectionProps {
  module: {
    slug: string;
    title: string;
    icon?: string;
    items: MenuItemType[];
  };
}

export function ModuleSection({ module }: ModuleSectionProps) {
  const { state } = useSidebar();
  const isExpanded = state === "expanded";
  const { openSections, toggleSection } = useSidebarStore();

  // Module section ID for state persistence
  const sectionId = `module-${module.slug}`;
  const isOpen = openSections.includes(sectionId);

  // Get module icon
  const ModuleIcon = (Icons as any)[module.icon || "Folder"] || Icons.Folder;

  if (module.items.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      {/* Module Header */}
      <div
        onClick={() => toggleSection(sectionId)}
        className={cn(
          "mb-1 flex cursor-pointer items-center rounded-md px-2 py-1.5 font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--font-color)_10%,transparent)]",
          "text-[color:var(--font-color)] hover:text-[color:var(--font-color)]"
        )}
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
              className="flex w-full items-center justify-between overflow-hidden"
            >
              <span className="overflow-hidden whitespace-nowrap text-sm">{module.title}</span>
              <ChevronRight
                className={cn(
                  "ml-auto h-3 w-3 shrink-0 text-[color:var(--font-color)] transition-transform duration-200",
                  isOpen && "rotate-90"
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chevron for collapsed state */}
        {!isExpanded && (
          <ChevronRight
            className={cn(
              "ml-1 h-3 w-3 shrink-0 text-[color:var(--font-color)] transition-transform duration-200",
              isOpen && "rotate-90"
            )}
          />
        )}
      </div>

      {/* Module Menu Items */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
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
