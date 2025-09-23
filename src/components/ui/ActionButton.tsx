"use client";

import * as React from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActionButtonProps extends ButtonProps {
  nested?: boolean;
  isActive?: boolean;
}

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ children, nested, isActive, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="ghost"
        className={cn("", nested && "", isActive && "", className)}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

ActionButton.displayName = "ActionButton";
