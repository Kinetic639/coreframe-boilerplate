"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarQuickActionButtonProps = {
  icon: LucideIcon;
  title: string;
  onClick: () => void;
  className?: string;
};

export const SidebarQuickActionButton = ({
  icon: Icon,
  title,
  onClick,
  className,
}: SidebarQuickActionButtonProps) => {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className={cn(
            "h-6 w-6 rounded-sm p-0.5 text-[color:var(--font-color)] opacity-40 transition hover:bg-[color-mix(in_srgb,var(--theme-color)_90%,white)] hover:text-[color:var(--font-color)] hover:opacity-100",
            className
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={4}
        className="rounded-sm bg-popover px-2 py-0.5 text-xs text-foreground"
      >
        {title}
      </TooltipContent>
    </Tooltip>
  );
};
