"use client";

import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Link, usePathname } from "@/i18n/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import * as Icons from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type MenuItem = {
  id: string;
  label: string;
  path?: string;
  icon?: string;
  submenu?: MenuItem[];
};

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
      className="absolute left-[-10px] top-1/2 h-[1px] origin-left -translate-y-1/2 rounded bg-current opacity-50 grayscale transition-all duration-200"
      style={{ width }}
      aria-hidden="true"
    />
  );
}

// ... wszystko jak w Twoim kodzie do tego miejsca:

export function RecursiveMenuItem({ item, nested = false }: { item: MenuItem; nested?: boolean }) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isExpanded = state === "expanded";

  const Icon = (Icons as any)[item.icon || "Dot"] || Icons.Dot;
  const isActive = pathname === item.path;
  const hasChildren = !!item.submenu?.length;

  const isAnySubActive = item.submenu?.some((child) => pathname === child.path) ?? false;

  const [open, setOpen] = useState(() => isAnySubActive);

  const content = (
    <>
      {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.span
            key="label"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="ml-3 overflow-hidden whitespace-nowrap text-sm"
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
              <SidebarMenuButton isActive={isActive}>
                <Icon className="h-4 w-4 flex-shrink-0" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{item.label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!hasChildren) {
    return (
      <SidebarMenuSubItem className="relative list-none py-0.5">
        {nested && (
          <span className="absolute bottom-0 left-[-10px] top-0 w-px bg-current opacity-50 grayscale" />
        )}
        <AnimatedHorizontalLine isActive={isActive} />
        <SidebarMenuSubButton
          asChild
          isActive={isActive}
          className={cn(
            "transition-colors duration-200 hover:bg-white/10",
            isActive && "font-bold text-sidebar-foreground",
            !isActive &&
              isAnySubActive &&
              "opacity-50 grayscale hover:opacity-100 hover:grayscale-0"
          )}
        >
          <Link href={item.path!} className="flex w-full items-center">
            <Icon className="mr-2 h-4 w-4" />
            <span className="text-sm">{item.label}</span>
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  return (
    <Accordion
      type="single"
      collapsible
      value={open ? item.id : undefined}
      onValueChange={(v) => setOpen(v === item.id)}
      className="w-full"
    >
      <AccordionItem value={item.id} className="relative border-none">
        {nested && (
          <span className="absolute bottom-0 left-[-10px] top-0 w-px bg-current opacity-50 grayscale" />
        )}

        <AccordionTrigger
          className={cn(
            "rounded-md px-2 py-2 text-base no-underline hover:bg-white/10",
            open && "bg-white/10 font-medium"
          )}
        >
          <div className="flex items-center">{content}</div>
        </AccordionTrigger>

        <AccordionContent className="px-0 pb-0 pt-1">
          <SidebarMenuSub className="relative ml-2 mr-0 pl-4 pr-0">
            {item?.submenu?.map((child) => (
              <RecursiveMenuItem key={child.id} item={child} nested={true} />
            ))}
          </SidebarMenuSub>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
