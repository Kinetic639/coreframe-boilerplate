"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

// Type definitions for up to 3 levels of nesting
export type NavItemLevel3 = {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
};

export type NavItemLevel2 = {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: NavItemLevel3[];
};

export type NavItemLevel1 = {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: NavItemLevel2[];
};

// Tree connector component - renders vertical and horizontal lines
// h-[calc(100%+4px)] extends vertical line to cover the gap-1 (4px) between items
function TreeConnector({ isLast }: { isLast: boolean }) {
  return (
    <>
      {/* Vertical line */}
      <span
        className={cn(
          "absolute -left-2.5 top-0 w-px bg-sidebar-foreground/20",
          isLast ? "h-[14px]" : "h-[calc(100%+4px)]"
        )}
        aria-hidden="true"
      />
      {/* Horizontal line */}
      <span
        className="absolute -left-2.5 top-[13px] h-px w-2.5 bg-sidebar-foreground/20"
        aria-hidden="true"
      />
    </>
  );
}

// Level 3 items (deepest level - no children)
function NavLevel3Item({ item, isLast }: { item: NavItemLevel3; isLast: boolean }) {
  return (
    <SidebarMenuSubItem>
      <TreeConnector isLast={isLast} />
      <SidebarMenuSubButton asChild>
        <a href={item.url}>
          {item.icon && <item.icon className="size-3.5" />}
          <span>{item.title}</span>
        </a>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

// Level 2 items (can have level 3 children)
function NavLevel2Item({ item, isLast }: { item: NavItemLevel2; isLast: boolean }) {
  const hasChildren = item.items && item.items.length > 0;

  if (!hasChildren) {
    return (
      <SidebarMenuSubItem>
        <TreeConnector isLast={isLast} />
        <SidebarMenuSubButton asChild>
          <a href={item.url}>
            {item.icon && <item.icon className="size-3.5" />}
            <span>{item.title}</span>
          </a>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuSubItem>
      <TreeConnector isLast={isLast} />
      <Collapsible defaultOpen={item.isActive} className="group/level2">
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton className="cursor-pointer w-full">
            {item.icon && <item.icon className="size-3.5" />}
            <span>{item.title}</span>
            <ChevronRight
              className={cn(
                "ml-auto size-3.5 transition-transform duration-200",
                "group-data-[state=open]/level2:rotate-90"
              )}
            />
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mx-0 ml-2 mr-0 px-0 pl-2.5 border-l-0">
            {item.items?.map((subItem, index) => (
              <NavLevel3Item
                key={subItem.title}
                item={subItem}
                isLast={index === item.items!.length - 1}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuSubItem>
  );
}

// Level 1 items (top level - can have level 2 children)
function NavLevel1Item({ item }: { item: NavItemLevel1 }) {
  const hasChildren = item.items && item.items.length > 0;

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={item.title}>
          <a href={item.url}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild defaultOpen={item.isActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mx-0 ml-3.5 mr-2 px-0 pl-2.5 border-l-0">
            {item.items?.map((subItem, index) => (
              <NavLevel2Item
                key={subItem.title}
                item={subItem}
                isLast={index === item.items!.length - 1}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function NavMain({ items }: { items: NavItemLevel1[] }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <NavLevel1Item key={item.title} item={item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
