import { Accordion } from "@/components/ui/accordion";

import { usePersistentAccordionList } from "@/lib/hooks/usePersistentAccordionList";

import { MenuItem } from "@/lib/types/module";
import { RecursiveMenuItem } from "./RecursiveMnuItem";
import { RoleCheck, Scope } from "@/lib/types/user";

type ModuleSectionProps = {
  module: {
    slug: string;
    title: string;
    icon?: string;
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
  const [openItems, setOpenItems] = usePersistentAccordionList(module.slug);

  return (
    <Accordion
      type="multiple"
      value={openItems}
      onValueChange={(v) => setOpenItems(v)}
      className="space-y-1"
    >
      <RecursiveMenuItem
        item={{
          id: module.slug,
          label: module.title,
          icon: module.icon,
          submenu: module.items.map((item) => ({
            ...item,
            allowedUsers: mapAllowedUsersToChecks(
              item.allowedUsers,
              activeOrgId,
              activeBranchId
            ) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          })),
        }}
      />
    </Accordion>
  );
}
