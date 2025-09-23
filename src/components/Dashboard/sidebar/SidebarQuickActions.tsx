"use client";

import { ChevronsUp, ChevronsDown } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { SidebarDropdownButton } from "./SidebarDropdownButton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SidebarQuickActions = () => {
  const { state } = useSidebar();
  const isExpanded = state === "expanded";
  const { expandAllSections, collapseAllSections } = useSidebarStore();

  return (
    <TooltipProvider>
      <div
        className={cn(
          "mt-2 px-2 pb-1 pt-1 transition-all duration-300",
          !isExpanded && "mt-1 px-1"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-1 pb-1 transition-all duration-300",
            isExpanded ? "justify-end" : "justify-center"
          )}
        >
          {/* Expand All Sections Button */}
          <SidebarDropdownButton
            icon={ChevronsDown}
            title="Expand all sections"
            onClick={() => expandAllSections()}
          />

          {/* Collapse All Sections Button */}
          <SidebarDropdownButton
            icon={ChevronsUp}
            title="Collapse all sections"
            onClick={() => collapseAllSections()}
          />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default SidebarQuickActions;
