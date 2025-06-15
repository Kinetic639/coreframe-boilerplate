"use client";
import { useState, useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  SidebarMenuSub,
  SidebarMenuButton,
  SidebarMenuSubItem,
  SidebarMenuItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "../ui/sidebar";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

function AnimatedHorizontalLine({ isActive }: { isActive: boolean }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (isActive) {
      setWidth(0);
      const timeout = setTimeout(() => setWidth(12), 10); // 12px = 0.75rem
      return () => clearTimeout(timeout);
    } else {
      setWidth(0);
    }
  }, [isActive]);

  return (
    <span
      className="absolute left-[-10px] top-1/2 h-[1px] origin-left -translate-y-1/2 rounded bg-current opacity-50 grayscale transition-all duration-200"
      style={{
        width: `${width}px`,
        transitionProperty: "width",
      }}
      aria-hidden="true"
    />
  );
}

type SidebarSectionProps = {
  section: {
    key: string;
    label: string;
    icon: string;
    children?: {
      key: string;
      label: string;
      href: string;
      icon?: string;
    }[];
  };
};

export default function SidebarSection({ section }: SidebarSectionProps) {
  const pathname = usePathname();
  const Icon = (Icons as any)[section.icon] || Icons.Package;
  const [open, setOpen] = useState(false);
  const { state } = useSidebar();
  const isExpanded = state === "expanded";

  if (!isExpanded) {
    console.log(section);
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuItem key={section.key} className="m-0 min-h-[40px] list-none">
              <SidebarMenuButton isActive={true}>
                <Icon className="h-4 w-4 flex-shrink-0" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{section.label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Accordion
      type="single"
      collapsible
      className="w-full"
      value={open ? section.key : undefined}
      onValueChange={(v) => setOpen(v === section.key)}
    >
      <AccordionItem value={section.key} className="border-none">
        <AccordionTrigger
          className={cn(
            "rounded-md px-2 py-2 text-base no-underline hover:bg-white/10",
            open && "bg-white/10 font-medium"
          )}
        >
          <div className="flex items-center">
            <Icon className="h-4 w-4 flex-shrink-0" />

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
                  {section.label}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-0 pb-0 pt-1">
          {section.children &&
            (() => {
              const anySubActive = section.children!.some(
                (item) => pathname === `/dashboard${item.href}`
              );

              return (
                <SidebarMenuSub className="py-1">
                  {section.children!.map((item) => {
                    const isActive = pathname === `/dashboard${item.href}`;
                    const ItemIcon = (Icons as any)[item.icon || "Dot"] || Icons.Dot;
                    return (
                      <SidebarMenuSubItem key={item.key} className="relative py-0.5">
                        <span
                          className={cn(
                            "absolute bottom-0 left-[-10px] top-0 w-px bg-current opacity-50 grayscale"
                          )}
                          aria-hidden="true"
                        />
                        <AnimatedHorizontalLine isActive={isActive} />
                        <SidebarMenuSubButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            "transition-colors duration-200 hover:bg-white/10",
                            isActive && "font-bold text-sidebar-foreground",
                            anySubActive &&
                              !isActive &&
                              "opacity-50 grayscale hover:opacity-100 hover:grayscale-0"
                          )}
                        >
                          <Link href={item.href} className="flex w-full items-center">
                            {ItemIcon && <ItemIcon className="mr-2 h-4 w-4" />}
                            <span className="text-sm">{item.label}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              );
            })()}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
