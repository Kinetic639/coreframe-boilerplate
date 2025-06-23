"use client";

import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { usePathname } from "@/i18n/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import * as Icons from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { getCanonicalPath } from "@/utils/getCanonicalPath";
import { Pathnames } from "@/i18n/routing";
import { ActionButton } from "@/components/ui/ActionButton";
import { SidebarLinkWithLoader } from "./SidebarLinkWithLoader";

export type MenuItem = {
  id: string;
  label: string;
  path?: Pathnames;
  icon?: string;
  type?: "link" | "action";
  onClick?: () => void;
  submenu?: MenuItem[];
};

function isPathActive(item: MenuItem, pathname: string): boolean {
  const itemCanonical = getCanonicalPath(item.path || "");
  const currentCanonical = getCanonicalPath(pathname);
  if (!itemCanonical || !currentCanonical) return false;
  if (itemCanonical === currentCanonical) return true;
  return item.submenu?.some((child) => isPathActive(child, pathname)) ?? false;
}

function AnimatedHorizontalLine({ isActive }: { isActive: boolean }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (isActive) {
      setWidth(0);
      const timeout = setTimeout(() => setWidth(12), 10);
      return () => clearTimeout(timeout);
    } else {
      setWidth(0);
    }
  }, [isActive]);

  return (
    <span
      className="absolute left-[-10px] top-1/2 h-[1px] origin-left -translate-y-1/2 rounded bg-[color:var(--font-color)] opacity-50 transition-all duration-200"
      style={{ width }}
      aria-hidden="true"
    />
  );
}

export function RecursiveMenuItem({ item, nested = false }: { item: MenuItem; nested?: boolean }) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isExpanded = state === "expanded";

  const Icon = (Icons as any)[item.icon || "Dot"] || Icons.Dot;
  const isActive = isPathActive(item, pathname);
  const hasChildren = !!item.submenu?.length;
  const isAction = item.type === "action";

  const iconClass = "h-4 w-4 stroke-[color:var(--font-color)] text-[color:var(--font-color)]";

  const content = (
    <>
      <Icon className={iconClass} />
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.span
            key="label"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="ml-3 overflow-hidden whitespace-nowrap text-sm text-[color:var(--font-color)]"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </>
  );

  if (!isExpanded) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuItem className="m-0 min-h-[40px] list-none">
              {isAction ? (
                <SidebarMenuButton isActive={false} onClick={item.onClick}>
                  <Icon className={iconClass} />
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton isActive={isActive}>
                  <Icon className={iconClass} />
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="text-[color:var(--font-color)]">{item.label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!hasChildren) {
    return (
      <SidebarMenuSubItem className="relative list-none py-0.5">
        {nested && (
          <span className="absolute bottom-0 left-[-10px] top-0 w-px bg-[color:var(--font-color)] opacity-50" />
        )}
        {!isAction && <AnimatedHorizontalLine isActive={isActive} />}
        <SidebarMenuSubButton
          asChild={!isAction}
          isActive={isActive}
          className={cn(
            "py-6 transition-colors duration-200",
            // !isAction && " hover:bg-white/10 ",
            // isAction && "py-0 p",
            isActive && "bg-white/10 font-bold"
          )}
          {...(isAction ? { onClick: item.onClick } : {})}
        >
          {isAction ? (
            <ActionButton
              className="w-full text-[color:var(--theme-color)]"
              onClick={item.onClick}
              nested={nested}
              isActive={isActive}
              variant="secondary"
            >
              <Icon
                className={cn(
                  "mr-2 h-4 w-4 stroke-[color:var(--theme-color)] text-[color:var(--theme-color)]",
                  nested && "ml-2"
                )}
              />
              <span className="mr-2 text-sm ">{item.label}</span>
            </ActionButton>
          ) : (
            <SidebarLinkWithLoader
              href={item.path!}
              className="flex w-full items-center text-[color:var(--font-color)] no-underline hover:no-underline"
            >
              <Icon className={cn("mr-2", iconClass)} />
              <span className="text-sm text-[color:var(--font-color)]">{item.label}</span>
            </SidebarLinkWithLoader>
          )}
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  return (
    <AccordionItem value={item.id} className="relative border-none">
      {nested && (
        <span className="absolute bottom-0 left-[-10px] top-0 w-px bg-[color:var(--font-color)] opacity-50" />
      )}
      <AccordionTrigger
        className={cn(
          "rounded-md px-2 py-2 text-base no-underline hover:bg-white/10",
          isActive && "bg-white/10 font-medium text-[color:var(--font-color)]",
          "text-[color:var(--font-color)]"
        )}
      >
        <div className="flex items-center">{content}</div>
      </AccordionTrigger>

      <AccordionContent className="px-0 pb-0 pt-1">
        <SidebarMenuSub className="relative ml-2 mr-0 pl-4 pr-0">
          {item.submenu?.map((child) => (
            <RecursiveMenuItem key={child.id} item={child} nested={true} />
          ))}
        </SidebarMenuSub>
      </AccordionContent>
    </AccordionItem>
  );
}
