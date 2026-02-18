"use client";

import { useMemo, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
  SidebarInset,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/nav-user";
import { SidebarBranchSwitcher } from "./sidebar-branch-switcher";
import { SidebarOrgHeader } from "./sidebar-org-header";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import { getUserDisplayName } from "@/utils/user-helpers";
import { DashboardStatusBar } from "@/components/Dashboard/DashboardStatusBar";
import { DashboardHeaderV2 } from "@/components/v2/layout/dashboard-header";
import { cn } from "@/lib/utils";
import { usePathname, Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { getIconComponent } from "@/lib/sidebar/v2/icon-map";
import { isItemActive } from "@/lib/sidebar/v2/active";
import { resolveSidebarLabel } from "@/lib/sidebar/v2/label";
import { toUnsafeI18nHref } from "@/lib/i18n/unsafe-href";
import type { SidebarItem, SidebarModel } from "@/lib/types/v2/sidebar";

// ---------------------------------------------------------------------------
// Sub-leaf: deepest level item (no children)
// ---------------------------------------------------------------------------
function NavSubLeaf({
  item,
  active,
  getLabel,
}: {
  item: SidebarItem;
  active: boolean;
  getLabel: (item: SidebarItem) => string;
}) {
  const Icon = getIconComponent(item.iconKey);
  const label = getLabel(item);
  return (
    <SidebarMenuSubItem>
      {item.href ? (
        <SidebarMenuSubButton asChild isActive={active}>
          <Link href={toUnsafeI18nHref(item.href)}>
            <Icon />
            <span>{label}</span>
          </Link>
        </SidebarMenuSubButton>
      ) : (
        <SidebarMenuSubButton isActive={active}>
          <Icon />
          <span>{label}</span>
        </SidebarMenuSubButton>
      )}
    </SidebarMenuSubItem>
  );
}

// ---------------------------------------------------------------------------
// L2 item: can be a leaf or a collapsible group (with L3 leaves)
// ---------------------------------------------------------------------------
function NavL2Item({
  item,
  pathname,
  getLabel,
}: {
  item: SidebarItem;
  pathname: string;
  getLabel: (item: SidebarItem) => string;
}) {
  const active = isItemActive(item, pathname);

  if (!item.children?.length) {
    return <NavSubLeaf item={item} active={active} getLabel={getLabel} />;
  }

  const Icon = getIconComponent(item.iconKey);
  return (
    <SidebarMenuSubItem>
      <Collapsible defaultOpen={active} className="group/l2">
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton className="cursor-pointer w-full">
            <Icon />
            <span>{getLabel(item)}</span>
            <ChevronRight
              className={cn(
                "ml-auto size-3.5 transition-transform duration-200",
                "group-data-[state=open]/l2:rotate-90"
              )}
            />
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child) => (
              <NavSubLeaf
                key={child.id}
                item={child}
                active={isItemActive(child, pathname)}
                getLabel={getLabel}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuSubItem>
  );
}

// ---------------------------------------------------------------------------
// L1 item: top-level — leaf or collapsible group (with L2 children)
// ---------------------------------------------------------------------------
function NavL1Item({
  item,
  pathname,
  getLabel,
}: {
  item: SidebarItem;
  pathname: string;
  getLabel: (item: SidebarItem) => string;
}) {
  const Icon = getIconComponent(item.iconKey);
  const active = isItemActive(item, pathname);
  const label = getLabel(item);

  if (!item.children?.length) {
    return (
      <SidebarMenuItem>
        {item.href ? (
          <SidebarMenuButton asChild tooltip={label} isActive={active}>
            <Link href={toUnsafeI18nHref(item.href)}>
              <Icon />
              <span>{label}</span>
            </Link>
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton tooltip={label} isActive={active}>
            <Icon />
            <span>{label}</span>
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild defaultOpen={active} className="group/l1">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={label} isActive={active}>
            <Icon />
            <span>{label}</span>
            <ChevronRight
              className={cn(
                "ml-auto transition-transform duration-200",
                "group-data-[state=open]/l1:rotate-90"
              )}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child) => (
              <NavL2Item key={child.id} item={child} pathname={pathname} getLabel={getLabel} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// NavSection: renders a group of L1 items
// ---------------------------------------------------------------------------
function NavSection({
  items,
  pathname,
  getLabel,
}: {
  items: SidebarItem[];
  pathname: string;
  getLabel: (item: SidebarItem) => string;
}) {
  if (!items.length) return null;
  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => (
          <NavL1Item key={item.id} item={item} pathname={pathname} getLabel={getLabel} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

// ---------------------------------------------------------------------------
// AppSidebar
// ---------------------------------------------------------------------------
interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  model: SidebarModel;
}

function AppSidebar({ model, ...props }: AppSidebarProps) {
  const { user } = useUserStoreV2();
  const pathname = usePathname();
  const t = useTranslations();
  const translator = useMemo(() => ({ t, has: t.has }), [t]);
  const getItemLabel = useCallback(
    (item: SidebarItem) => resolveSidebarLabel(item, translator),
    [translator]
  );

  const userData = user
    ? {
        name: getUserDisplayName(user.first_name, user.last_name),
        email: user.email || "",
        avatar: user.avatar_url || "",
      }
    : {
        name: "User",
        email: "",
        avatar: "",
      };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="bg-muted border-b">
        <SidebarOrgHeader />
        <SidebarBranchSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavSection items={model.main} pathname={pathname} getLabel={getItemLabel} />
        <NavSection items={model.footer} pathname={pathname} getLabel={getItemLabel} />
      </SidebarContent>
      <SidebarFooter className="bg-muted border-t">
        <NavUser user={userData} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

// ---------------------------------------------------------------------------
// DashboardShell
// ---------------------------------------------------------------------------
interface DashboardShellProps {
  children: React.ReactNode;
  sidebarModel: SidebarModel;
}

export function DashboardShell({ children, sidebarModel }: DashboardShellProps) {
  const sidebarCollapsed = useUiStoreV2((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStoreV2((s) => s.setSidebarCollapsed);

  const handleSidebarOpenChange = (open: boolean) => {
    setSidebarCollapsed(!open);
  };

  return (
    <SidebarProvider open={!sidebarCollapsed} onOpenChange={handleSidebarOpenChange}>
      <AppSidebar model={sidebarModel} />
      <SidebarInset className="flex flex-col">
        <DashboardHeaderV2 />
        <main className="flex-1 overflow-auto p-4 pb-12">{children}</main>
        <DashboardStatusBar />
      </SidebarInset>
    </SidebarProvider>
  );
}
