"use client";

import { useState, useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    if (section.children?.some((item) => pathname.startsWith(item.href))) {
      setOpen(true);
    }
  }, [pathname]);

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
            "flex items-center rounded-md px-2 py-2 text-base no-underline hover:bg-white/10",
            open && "bg-white/10 font-medium"
          )}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="ml-3 text-sm">{section.label}</span>
        </AccordionTrigger>
        <AccordionContent className="px-0 pb-0 pt-1">
          <SidebarMenuSub className="py-1">
            {section.children?.map((item) => {
              const isActive = pathname === item.href;
              const ItemIcon = (Icons as any)[item.icon || "Dot"] || Icons.Dot;

              return (
                <SidebarMenuSubItem key={item.key} className="relative py-0.5">
                  {/* Pionowy pasek */}
                  <span
                    className={cn(
                      "absolute bottom-0 left-[-10px] top-0 w-px bg-current opacity-50 grayscale"
                    )}
                    aria-hidden="true"
                  />
                  {/* Pozioma kreska dla aktywnego */}
                  {isActive && (
                    <span
                      className="absolute left-[-15px] top-1/2 h-6 w-1 -translate-y-1/2 rounded bg-sidebar-foreground transition-all duration-200"
                      aria-hidden="true"
                    />
                  )}
                  <SidebarMenuSubButton
                    asChild
                    isActive={isActive}
                    className={cn(
                      "flex w-full items-center transition-colors duration-200 hover:bg-white/10",
                      isActive && "font-bold text-sidebar-foreground",
                      !isActive && "opacity-50 grayscale hover:opacity-100 hover:grayscale-0"
                    )}
                  >
                    <Link href={item.href} className="flex items-center gap-2 text-sm">
                      <ItemIcon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
