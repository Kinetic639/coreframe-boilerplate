"use client";

import { Accordion } from "@/components/ui/accordion";
import { usePersistentAccordionList } from "@/lib/hooks/usePersistentAccordionList";
import { MenuItem } from "@/lib/types/module";
import { RecursiveMenuItem } from "./RecursiveMnuItem";

interface ModuleSectionClientProps {
  module: {
    slug: string;
    title: string;
    icon?: string;
    items: MenuItem[];
  };
  activeOrgId: string | null;
  activeBranchId: string | null;
}

export default function ModuleSectionClient({ module }: ModuleSectionClientProps) {
  const [openItems, setOpenItems] = usePersistentAccordionList(module.slug);

  return (
    <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="space-y-1">
      <RecursiveMenuItem
        item={{
          id: module.slug,
          label: module.title,
          icon: module.icon,
          submenu: module.items as any,
        }}
      />
    </Accordion>
  );
}
