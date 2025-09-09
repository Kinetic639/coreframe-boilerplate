"use client";

import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import * as Icons from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { MenuItem as MenuItemType } from "@/lib/types/module";

interface TreeMenuItemProps {
  item: MenuItemType;
  level?: number;
  moduleSlug?: string;
}

export function TreeMenuItem({ item, level = 0, moduleSlug = "" }: TreeMenuItemProps) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isExpanded = state === "expanded";
  const { openSections, toggleSection } = useSidebarStore();

  // Create unique section ID for state persistence
  const sectionId = moduleSlug ? `${moduleSlug}-${item.id}` : item.id;
  const isOpen = openSections.includes(sectionId);

  // Get icon component
  const IconComponent = (Icons as any)[item.icon] || Icons.Dot;

  // Check if item is active
  const isActive = "path" in item && pathname === item.path;

  // Check if any child is active (for highlighting parent)
  const hasActiveChild =
    "submenu" in item &&
    item.submenu?.some((subItem: MenuItemType) => "path" in subItem && pathname === subItem.path);

  // Handle action items (buttons)
  if (item.type === "action") {
    return (
      <div
        className={cn(
          "flex cursor-pointer items-center rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/50",
          level > 0 && "ml-4",
          isActive && "bg-accent font-medium"
        )}
      >
        <IconComponent className="h-4 w-4 shrink-0" />
        <AnimatePresence>
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0, width: 0, marginLeft: 0 }}
              animate={{ opacity: 1, width: "auto", marginLeft: 8 }}
              exit={{ opacity: 0, width: 0, marginLeft: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden whitespace-nowrap"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Handle items without submenu (leaf nodes)
  if (!("submenu" in item) || !item.submenu?.length) {
    return (
      <Link href={item.path as any} className="block">
        <div
          className={cn(
            "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/50",
            level > 0 && "ml-4",
            isActive && "bg-accent font-medium"
          )}
        >
          <IconComponent className="h-4 w-4 shrink-0" />
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                animate={{ opacity: 1, width: "auto", marginLeft: 8 }}
                exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden whitespace-nowrap"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </Link>
    );
  }

  // Handle items with submenu (branch nodes)
  return (
    <div className="w-full">
      <div
        onClick={() => toggleSection(sectionId)}
        className={cn(
          "flex cursor-pointer items-center rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/50",
          level > 0 && "ml-4",
          (isActive || hasActiveChild) && "bg-accent font-medium"
        )}
      >
        <IconComponent className="h-4 w-4 shrink-0" />

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, width: 0, marginLeft: 0 }}
              animate={{ opacity: 1, width: "auto", marginLeft: 8 }}
              exit={{ opacity: 0, width: 0, marginLeft: 0 }}
              transition={{ duration: 0.2 }}
              className="flex w-full items-center justify-between overflow-hidden"
            >
              <span className="overflow-hidden whitespace-nowrap">{item.label}</span>
              <ChevronRight
                className={cn(
                  "ml-auto h-3 w-3 shrink-0 transition-transform duration-200",
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
              "ml-1 h-3 w-3 shrink-0 transition-transform duration-200",
              isOpen && "rotate-90"
            )}
          />
        )}
      </div>

      {/* Submenu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn("space-y-0.5 pl-2", level > 0 && "pl-6")}>
              {item.submenu?.map((subItem: MenuItemType) => (
                <TreeMenuItem
                  key={subItem.id}
                  item={subItem}
                  level={level + 1}
                  moduleSlug={moduleSlug}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
