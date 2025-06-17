"use client";

import { useSidebar } from "@/components/ui/sidebar";
import { motion } from "framer-motion";
import { MenuItem } from "@/lib/types/module";
import { RecursiveMenuItem } from "./RecursiveMnuItem";

type ModuleSectionProps = {
  module: {
    slug: string;
    title: string;
    items: MenuItem[];
  };
};

export default function ModuleSection({ module }: ModuleSectionProps) {
  const { state } = useSidebar();
  const isExpanded = state === "expanded";

  return (
    <div className="space-y-1">
      <motion.p
        initial={false}
        animate={{ opacity: isExpanded ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="mb-1 list-none overflow-hidden whitespace-nowrap  text-sm text-orange-300 transition-opacity"
      >
        {module.title}
      </motion.p>
      {module.items.map((item) => (
        <RecursiveMenuItem key={item.id} item={item} />
      ))}
    </div>
  );
}
