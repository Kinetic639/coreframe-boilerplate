"use client";

import { ChevronsUp, Expand } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { SidebarQuickActionButton } from "./SidebarQuickActionButton";

const SidebarQuickActions = () => {
  const { state } = useSidebar();
  const isExpanded = state === "expanded";

  if (!isExpanded) return null;

  return (
    <div className="mt-2 px-2 pb-1 pt-1">
      <div className="flex items-center justify-end gap-1 border-border/40 pb-1">
        <SidebarQuickActionButton
          icon={ChevronsUp}
          title="Collapse all sections"
          onClick={() => {
            console.log("Collapse All");
          }}
        />
        <SidebarQuickActionButton
          icon={Expand}
          title="Toggle multi-open mode"
          onClick={() => {
            console.log("Toggle Multi-Open Mode");
          }}
        />
      </div>
    </div>
  );
};

export default SidebarQuickActions;
