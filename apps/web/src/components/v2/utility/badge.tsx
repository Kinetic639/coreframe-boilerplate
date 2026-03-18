"use client";

import { Badge as BadgeUI } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
  size?: "sm" | "md" | "lg";
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  size = "md",
  removable = false,
  onRemove,
  className,
}: BadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2.5 py-0.5",
    lg: "text-base px-3 py-1",
  };

  const variantClasses = {
    success: "bg-green-100 text-green-800 hover:bg-green-100/80 border-green-300",
    warning: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80 border-yellow-300",
    info: "bg-blue-100 text-blue-800 hover:bg-blue-100/80 border-blue-300",
  };

  const customVariant =
    variant === "success" || variant === "warning" || variant === "info" ? "outline" : variant;

  return (
    <BadgeUI
      variant={customVariant}
      className={cn(
        sizeClasses[size],
        variant === "success" && variantClasses.success,
        variant === "warning" && variantClasses.warning,
        variant === "info" && variantClasses.info,
        removable && "pr-1",
        className
      )}
    >
      {children}
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:bg-black/10 rounded-full p-0.5 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </BadgeUI>
  );
}
