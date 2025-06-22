"use client";

import { Accordion } from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { usePersistentAccordionList } from "@/lib/hooks/usePersistentAccordionList";
import { useSidebar } from "@/components/ui/sidebar";
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

  const [openItems, setOpenItems] = usePersistentAccordionList(module.slug);

  return (
    <Accordion
      type="multiple"
      value={openItems}
      onValueChange={(v) => setOpenItems(v)}
      className="space-y-1"
    >
      <motion.p
        initial={false}
        animate={{ opacity: isExpanded ? 0.5 : 0 }}
        transition={{ duration: 0.2 }}
        className="mb-1.5 list-none text-xs  text-[color:var(--font-color)]"
      >
        {module.title}
      </motion.p>
      {module.items.map((item) => (
        <RecursiveMenuItem key={item.id} item={item} />
      ))}
    </Accordion>
  );
}
