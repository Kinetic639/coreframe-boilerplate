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
          title={title}
          onClick={onClick}
          className={cn("rounded-md", className)}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{title}</TooltipContent>
    </Tooltip>
  );
};
