"use client";

import { ChevronsUp, Expand } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { SidebarQuickActionButton } from "./SidebarQuickActionButton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SidebarQuickActions = () => {
  const { state } = useSidebar();
  const isExpanded = state === "expanded";
  const { setSections } = useSidebarStore();

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
          <SidebarQuickActionButton
            icon={ChevronsUp}
            title="Collapse all sections"
            onClick={() => {
              setSections([]);
            }}
          />
          <SidebarQuickActionButton
            icon={Expand}
            title="Toggle multi-open mode"
            onClick={() => {
              console.warn("Toggle Multi-Open Mode");
            }}
          />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default SidebarQuickActions;
