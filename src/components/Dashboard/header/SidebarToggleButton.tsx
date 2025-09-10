"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { cn } from "@/lib/utils";

export function SidebarToggleButton() {
  const { open, setOpen } = useSidebar();
  const { mode } = useSidebarStore();

  // Don't show in auto mode
  if (mode === "auto") {
    return null;
  }

  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onClick={() => setOpen(!open)}
      className={cn(
        "group flex h-9 w-10 items-center justify-center transition-all duration-200",
        // Match sidebar background and styling
        "bg-[color:var(--sidebar-background)] text-[color:var(--font-color)]",
        "border-b border-r border-t border-[color-mix(in_srgb,var(--font-color)_20%,transparent)]",
        "rounded-r-md hover:bg-[color-mix(in_srgb,var(--font-color)_10%,transparent)]",
        // Make it look attached to sidebar - no left border, negative margin
        "-ml-px border-l-0",
        "shadow-md hover:shadow-lg"
      )}
    >
      <motion.div
        animate={{ rotate: open ? 0 : 180 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex items-center justify-center"
      >
        {open ? (
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:scale-110" />
        ) : (
          <ChevronRight className="h-4 w-4 transition-transform group-hover:scale-110" />
        )}
      </motion.div>
    </motion.button>
  );
}
