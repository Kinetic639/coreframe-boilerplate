"use client";

import { useMemo, useCallback } from "react";
import { Shield } from "lucide-react";
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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/nav-user";
import { Separator } from "@/components/ui/separator";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { getIconComponent } from "@/lib/sidebar/v2/icon-map";
import { isItemActive } from "@/lib/sidebar/v2/active";
import { resolveSidebarLabel } from "@/lib/sidebar/v2/label";
import { toUnsafeI18nHref } from "@/lib/i18n/unsafe-href";
import type { SidebarItem, SidebarModel } from "@/lib/types/v2/sidebar";

// ---------------------------------------------------------------------------
// AdminNavItem: flat L1 item (no children in admin nav for now)
// ---------------------------------------------------------------------------
function AdminNavItem({
  item,
  pathname,
  getLabel,
}: {
  item: SidebarItem;
  pathname: string;
  getLabel: (item: SidebarItem) => string;
}) {
  const Icon = getIconComponent(item.iconKey);
  const active = item.disabledReason ? false : isItemActive(item, pathname);
  const label = getLabel(item);

  if (item.disabledReason) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={label} className="opacity-50 cursor-not-allowed">
          <Icon />
          <span>{label}</span>
          {item.disabledReason === "coming_soon" && (
            <span className="ml-auto text-[10px] font-medium">Soon</span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

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

// ---------------------------------------------------------------------------
// AdminSidebar
// ---------------------------------------------------------------------------
interface AdminSidebarProps extends React.ComponentProps<typeof Sidebar> {
  model: SidebarModel;
  user: { name: string; email: string; avatar: string };
}

function AdminSidebar({ model, user, ...props }: AdminSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const translator = useMemo(() => ({ t, has: t.has }), [t]);
  const getItemLabel = useCallback(
    (item: SidebarItem) => resolveSidebarLabel(item, translator),
    [translator]
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="bg-muted border-b">
        <div className="flex items-center gap-2 px-2 py-1">
          <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold truncate group-data-[collapsible=icon]:hidden">
            Admin Panel
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {model.main.length > 0 && (
          <SidebarGroup>
            <SidebarMenu>
              {model.main.map((item) => (
                <AdminNavItem
                  key={item.id}
                  item={item}
                  pathname={pathname}
                  getLabel={getItemLabel}
                />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="bg-muted border-t">
        <NavUser user={user} isAdmin={true} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

// ---------------------------------------------------------------------------
// AdminHeader
// ---------------------------------------------------------------------------
function AdminHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 bg-muted shadow-sm">
      <div className="flex items-center gap-2 px-6">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span className="text-sm font-medium text-muted-foreground">Admin Dashboard</span>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// AdminShell
// ---------------------------------------------------------------------------
interface AdminShellProps {
  children: React.ReactNode;
  sidebarModel: SidebarModel;
  user: { name: string; email: string; avatar: string };
}

export function AdminShell({ children, sidebarModel, user }: AdminShellProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <AdminSidebar model={sidebarModel} user={user} />
      <SidebarInset className="flex flex-col">
        <AdminHeader />
        <main className="flex-1 overflow-auto p-4 pb-12">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
