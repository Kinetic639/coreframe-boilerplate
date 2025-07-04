"use client";

import { Button } from "@/components/ui/button";
import { ChevronsUp, Expand } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

const SidebarQuickActions = () => {
  const { state } = useSidebar();
  const isExpanded = state === "expanded";

  if (!isExpanded) return null;

  return (
    <div className="mt-3 flex gap-2">
      <Button
        variant="ghost"
        size="icon"
        title="Collapse All"
        onClick={() => {
          // TODO: implement collapse all
          console.log("Collapse All");
        }}
      >
        <ChevronsUp className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        title="Toggle Multi-Open"
        onClick={() => {
          // TODO: implement toggle multi-open
          console.log("Toggle Multi-Open Mode");
        }}
      >
        <Expand className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default SidebarQuickActions;
