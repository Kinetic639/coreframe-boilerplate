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
  moduleSlug?: string;
  level?: number;
  isLast?: boolean;
  parentLevels?: boolean[];
  hasActiveItemInModule?: boolean;
  hasActiveItemInAnyModule?: boolean;
}

export function TreeMenuItem({
  item,
  moduleSlug = "",
  level = 0,
  isLast = false,
  parentLevels = [],
  hasActiveItemInModule = false,
  hasActiveItemInAnyModule = false,
}: TreeMenuItemProps) {
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

  // Check if this item or any descendant is active (for the active path)
  const isInActivePath = isActive || hasActiveChild;

  // Should this item be grayed out?
  // Gray out if there's an active item somewhere AND this module doesn't have active items
  // OR if there's an active item in this module but this specific item is not in the active path
  const shouldGrayOut =
    hasActiveItemInAnyModule &&
    (!hasActiveItemInModule || (hasActiveItemInModule && !isInActivePath));

  // Calculate responsive indentation
  const indent = isExpanded ? 16 : 12;
  const paddingLeft = level > 0 ? 8 + level * indent : 8;

  // Tree line styles for nested items
  const getTreeLineStyle = (): React.CSSProperties[] => {
    if (level === 0) return [];

    const lines: React.CSSProperties[] = [];

    // Add vertical lines for parent levels - extend beyond element bounds for continuity
    for (let i = 0; i < level - 1; i++) {
      const shouldShowLine = i < parentLevels.length ? parentLevels[i] : true;
      if (shouldShowLine) {
        lines.push({
          position: "absolute",
          left: `${8 + i * indent + 6}px`,
          top: "-2px", // Extend above element
          bottom: "-2px", // Extend below element
          width: "2px",
          backgroundColor: "var(--font-color)",
          filter: "brightness(0.4)",
          zIndex: 1, // Behind hover effects
        });
      }
    }

    // Add current level vertical line
    if (level > 0) {
      lines.push({
        position: "absolute",
        left: `${8 + (level - 1) * indent + 6}px`,
        top: isLast ? "-2px" : "-2px", // Always start from top
        bottom: isLast ? "50%" : "-2px", // Stop at middle if last, otherwise continue
        width: "2px",
        backgroundColor: "var(--font-color)",
        filter: "brightness(0.4)",
        zIndex: 1, // Behind hover effects
      });
    }

    // Add horizontal connector line
    lines.push({
      position: "absolute",
      left: `${8 + (level - 1) * indent + 6}px`,
      top: "50%",
      width: `${indent - 6}px`,
      height: "2px",
      backgroundColor: "var(--font-color)",
      filter: "brightness(0.4)",
      transform: "translateY(-50%)",
      zIndex: 1, // Behind hover effects
    });

    return lines;
  };

  const treeLines = getTreeLineStyle();

  // Handle action items (buttons)
  if (item.type === "action") {
    return (
      <div className="relative">
        {/* Render tree lines */}
        {treeLines.map((lineStyle, index) => (
          <div key={index} style={lineStyle} />
        ))}

        <div
          className={cn(
            "relative flex cursor-pointer items-center rounded-md py-1.5 text-sm transition-all duration-200",
            "text-[color:var(--font-color)] hover:bg-[color-mix(in_srgb,var(--font-color)_10%,transparent)] hover:text-[color:var(--font-color)]",
            shouldGrayOut && "brightness-75 filter"
          )}
          style={{
            paddingLeft: `${paddingLeft}px`,
            zIndex: 2, // Above tree lines
          }}
        >
          <IconComponent className="h-4 w-4 shrink-0 text-[color:var(--font-color)]" />
          <AnimatePresence mode="wait">
            {isExpanded && (
              <motion.span
                key="expanded-text"
                initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                animate={{ opacity: 1, width: "auto", marginLeft: 8 }}
                exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="overflow-hidden whitespace-nowrap"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Handle items without submenu (leaf nodes)
  if (!("submenu" in item) || !item.submenu?.length) {
    return (
      <div className="relative">
        {/* Render tree lines */}
        {treeLines.map((lineStyle, index) => (
          <div key={index} style={lineStyle} />
        ))}

        <Link href={item.path as any} className="block">
          <div
            className={cn(
              "relative flex items-center rounded-md py-1.5 text-sm transition-all duration-200",
              "text-[color:var(--font-color)] hover:bg-[color-mix(in_srgb,var(--font-color)_10%,transparent)] hover:text-[color:var(--font-color)]",
              shouldGrayOut && "brightness-75 filter"
            )}
            style={{
              paddingLeft: `${paddingLeft}px`,
              zIndex: 2, // Above tree lines
            }}
          >
            <IconComponent className="h-4 w-4 shrink-0 text-[color:var(--font-color)]" />
            <AnimatePresence mode="wait">
              {isExpanded && (
                <motion.span
                  key="expanded-text"
                  initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                  animate={{ opacity: 1, width: "auto", marginLeft: 8 }}
                  exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </Link>
      </div>
    );
  }

  // Handle items with submenu (branch nodes)
  return (
    <div className="w-full">
      <div className="relative">
        {/* Render tree lines */}
        {treeLines.map((lineStyle, index) => (
          <div key={index} style={lineStyle} />
        ))}

        <div
          onClick={() => toggleSection(sectionId)}
          className={cn(
            "relative flex cursor-pointer items-center rounded-md py-1.5 text-sm transition-all duration-200",
            "text-[color:var(--font-color)] hover:bg-[color-mix(in_srgb,var(--font-color)_10%,transparent)] hover:text-[color:var(--font-color)]",
            shouldGrayOut && "brightness-75 filter"
          )}
          style={{
            paddingLeft: `${paddingLeft}px`,
            zIndex: 2, // Above tree lines
          }}
        >
          <IconComponent className="h-4 w-4 shrink-0 text-[color:var(--font-color)]" />

          <AnimatePresence mode="wait">
            {isExpanded && (
              <motion.div
                key="expanded-div"
                initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                animate={{ opacity: 1, width: "auto", marginLeft: 8 }}
                exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="flex w-full items-center justify-between overflow-hidden"
              >
                <span className="flex-1 overflow-hidden whitespace-nowrap">{item.label}</span>
                <ChevronRight
                  className={cn(
                    "ml-3 h-3 w-3 shrink-0 text-[color:var(--font-color)] transition-transform duration-200",
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
                "ml-3 h-3 w-3 shrink-0 text-[color:var(--font-color)] transition-transform duration-200",
                isOpen && "rotate-90"
              )}
            />
          )}
        </div>
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
            <div className="space-y-0.5">
              {item.submenu?.map((subItem: MenuItemType, index) => {
                const isLastChild = index === item.submenu!.length - 1;
                const newParentLevels = [...parentLevels, !isLast];

                return (
                  <TreeMenuItem
                    key={subItem.id}
                    item={subItem}
                    moduleSlug={moduleSlug}
                    level={level + 1}
                    isLast={isLastChild}
                    parentLevels={newParentLevels}
                    hasActiveItemInModule={hasActiveItemInModule}
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
