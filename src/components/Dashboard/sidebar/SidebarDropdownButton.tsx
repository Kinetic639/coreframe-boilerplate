"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type DropdownOption = {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
};

type SidebarDropdownButtonProps = {
  icon: LucideIcon;
  title: string;
  onClick?: () => void;
  options?: DropdownOption[];
  className?: string;
  isActive?: boolean;
};

export const SidebarDropdownButton = ({
  icon: Icon,
  title,
  onClick,
  options,
  className,
  isActive = false,
}: SidebarDropdownButtonProps) => {
  if (options && options.length > 0) {
    return (
      <DropdownMenu>
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 rounded-sm p-0.5 text-[color:var(--font-color)] opacity-40 transition hover:bg-[color-mix(in_srgb,var(--theme-color)_90%,white)] hover:text-[color:var(--font-color)] hover:opacity-100",
                  isActive && "bg-[color-mix(in_srgb,var(--theme-color)_80%,white)] opacity-100",
                  className
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={4}
            className="rounded-sm bg-popover px-2 py-0.5 text-xs text-foreground"
          >
            {title}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="min-w-[180px]">
          {options.map((option, index) => (
            <DropdownMenuItem key={index} onClick={option.onClick}>
              {option.icon && <option.icon className="mr-2 h-4 w-4" />}
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className={cn(
            "h-6 w-6 rounded-sm p-0.5 text-[color:var(--font-color)] opacity-40 transition hover:bg-[color-mix(in_srgb,var(--theme-color)_90%,white)] hover:text-[color:var(--font-color)] hover:opacity-100",
            isActive && "bg-[color-mix(in_srgb,var(--theme-color)_80%,white)] opacity-100",
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
