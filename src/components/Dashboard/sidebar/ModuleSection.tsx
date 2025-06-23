"use client";

import { Accordion } from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { usePersistentAccordionList } from "@/lib/hooks/usePersistentAccordionList";
import { useSidebar } from "@/components/ui/sidebar";
import { MenuItem } from "@/lib/types/module";
import { RecursiveMenuItem } from "./RecursiveMnuItem";
import { RoleCheck, Scope } from "@/lib/types/user";
import HasAnyRoleClient from "@/components/auth/HasAnyRoleClient";

type ModuleSectionProps = {
  module: {
    slug: string;
    title: string;
    items: MenuItem[];
  };
  activeOrgId: string | null;
  activeBranchId: string | null;
};

function mapAllowedUsersToChecks(
  allowedUsers: MenuItem["allowedUsers"],
  activeOrgId: string | null,
  activeBranchId: string | null
): RoleCheck[] {
  if (!allowedUsers) return [];

  return allowedUsers.map((u) => ({
    role: u.role,
    scope: u.scope as Scope,
    id: u.scope === "org" ? (activeOrgId ?? undefined) : (activeBranchId ?? undefined),
  }));
}

export default function ModuleSection({ module, activeBranchId, activeOrgId }: ModuleSectionProps) {
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
      {module.items.map((item) => {
        const checks = mapAllowedUsersToChecks(item.allowedUsers, activeOrgId, activeBranchId);

        if (!checks.length) {
          return <RecursiveMenuItem key={item.id} item={item} />;
        }

        return (
          <HasAnyRoleClient key={item.id} checks={checks}>
            <RecursiveMenuItem item={item} />
          </HasAnyRoleClient>
        );
      })}
    </Accordion>
  );
}
