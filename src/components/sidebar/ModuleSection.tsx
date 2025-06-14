"use client";
import React from "react";
import SidebarSection from "./SidebarSection";
import { useSidebar } from "../ui/sidebar";
import { motion } from "framer-motion";

type ModuleSectionProps = {
  module: {
    slug: string;
    label: string;
    settings: {
      sidebar: {
        key: string;
        label: string;
        icon: string;
        children?: {
          key: string;
          label: string;
          href: string;
          icon?: string;
        }[];
      }[];
    };
  };
};

export default function ModuleSection({ module }: ModuleSectionProps) {
  const { label, settings } = module;
  const sections = settings.sidebar ?? [];
  const { state } = useSidebar();
  const isExpanded = state === "expanded";

  return (
    <div className="space-y-0">
      <motion.p
        initial={false}
        animate={{ opacity: isExpanded ? 1 : 0 }}
        transition={{ duration: 0.2, delay: 0.15 }}
        className="overflow-hidden whitespace-nowrap text-sm font-semibold text-white transition-opacity duration-200"
      >
        {label}
      </motion.p>
      {sections.map((section) => (
        <SidebarSection key={section.key} section={section} />
      ))}
    </div>
  );
}
